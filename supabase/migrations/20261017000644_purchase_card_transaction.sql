-- ============================================================
-- ZONA DIAMANTE
-- Purchase card transaction
-- ============================================================
--
-- Performs a complete points-based card purchase atomically.
--
-- Guarantees:
-- - only active cards can be purchased;
-- - only cards with unlock_method = 'points' can be purchased;
-- - the same user cannot own the same card twice;
-- - the user's balance can never become negative;
-- - the points deduction and card assignment happen together;
-- - retries with the same idempotency key do not charge twice;
-- - every successful purchase is recorded in reward_events.
-- ============================================================

grant update (
    points_balance,
    updated_at
)
on table public.profiles
to service_role;

create or replace function public.purchase_card(
    p_user_id uuid,
    p_card_id bigint,
    p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_card_name text;
    v_card_slug text;
    v_card_cost integer;
    v_unlock_method text;
    v_card_active boolean;

    v_current_balance integer;
    v_new_balance integer;

    v_existing_event_id uuid;
    v_existing_user_id uuid;
    v_existing_card_id bigint;
    v_existing_event_type text;
    v_existing_points_delta integer;

    v_reward_id uuid;
begin

    -- ========================================================
    -- 1. Basic validation
    -- ========================================================

    if p_user_id is null then
        raise exception 'User id is required.';
    end if;

    if p_card_id is null then
        raise exception 'Card id is required.';
    end if;

    if p_idempotency_key is null
       or length(trim(p_idempotency_key)) = 0 then
        raise exception 'Idempotency key is required.';
    end if;


    -- ========================================================
    -- 2. Serialize requests using the same idempotency key
    -- ========================================================

    perform pg_advisory_xact_lock(
        hashtextextended(
            p_idempotency_key,
            0
        )
    );


    -- ========================================================
    -- 3. Idempotency check
    -- ========================================================

    select
        id,
        user_id,
        card_id,
        event_type,
        points_delta
    into
        v_existing_event_id,
        v_existing_user_id,
        v_existing_card_id,
        v_existing_event_type,
        v_existing_points_delta
    from public.reward_events
    where idempotency_key = p_idempotency_key;

    if found then

        if v_existing_user_id <> p_user_id
           or v_existing_card_id is distinct from p_card_id
           or v_existing_event_type <> 'card_purchase' then

            raise exception
                'Idempotency key belongs to another operation.';
        end if;


        select points_balance
        into v_current_balance
        from public.profiles
        where id = p_user_id;

        if not found then
            raise exception 'Profile not found.';
        end if;


        select
            name,
            slug
        into
            v_card_name,
            v_card_slug
        from public.cards
        where id = p_card_id;

        return jsonb_build_object(
            'reward_id', v_existing_event_id,
            'user_id', p_user_id,
            'card_id', p_card_id,
            'card_name', v_card_name,
            'card_slug', v_card_slug,
            'points_delta', v_existing_points_delta,
            'points_balance', v_current_balance,
            'already_processed', true
        );
    end if;


    -- ========================================================
    -- 4. Load and validate card
    -- ========================================================

    select
        name,
        slug,
        cost,
        unlock_method,
        is_active
    into
        v_card_name,
        v_card_slug,
        v_card_cost,
        v_unlock_method,
        v_card_active
    from public.cards
    where id = p_card_id
    for share;

    if not found then
        raise exception 'Card not found.';
    end if;

    if v_card_active is not true then
        raise exception 'Card is not active.';
    end if;

    if v_unlock_method <> 'points' then
        raise exception 'Card cannot be purchased with points.';
    end if;


    -- ========================================================
    -- 5. Lock user balance
    --
    -- This serializes simultaneous purchases for the same user.
    -- ========================================================

    select points_balance
    into v_current_balance
    from public.profiles
    where id = p_user_id
    for update;

    if not found then
        raise exception 'Profile not found.';
    end if;


    -- ========================================================
    -- 6. Prevent duplicate ownership
    -- ========================================================

    if exists (
        select 1
        from public.user_cards
        where user_id = p_user_id
          and card_id = p_card_id
    ) then
        raise exception 'Card already owned.';
    end if;


    -- ========================================================
    -- 7. Validate balance
    -- ========================================================

    if v_current_balance < v_card_cost then
        raise exception 'Insufficient points balance.';
    end if;

    v_new_balance :=
        v_current_balance - v_card_cost;


    -- ========================================================
    -- 8. Assign card
    -- ========================================================

    insert into public.user_cards (
        user_id,
        card_id,
        source
    )
    values (
        p_user_id,
        p_card_id,
        'points'
    );


    -- ========================================================
    -- 9. Deduct points
    -- ========================================================

    update public.profiles
    set
        points_balance = v_new_balance,
        updated_at = now()
    where id = p_user_id;


    -- ========================================================
    -- 10. Record the points movement
    -- ========================================================

    insert into public.reward_events (
        user_id,
        attempt_id,
        event_type,
        points_delta,
        card_id,
        idempotency_key,
        metadata
    )
    values (
        p_user_id,
        null,
        'card_purchase',
        -v_card_cost,
        p_card_id,
        p_idempotency_key,
        jsonb_build_object(
            'card_name', v_card_name,
            'card_slug', v_card_slug,
            'cost', v_card_cost,
            'unlock_method', v_unlock_method
        )
    )
    returning id
    into v_reward_id;


    -- ========================================================
    -- 11. Return result
    -- ========================================================

    return jsonb_build_object(
        'reward_id', v_reward_id,
        'user_id', p_user_id,
        'card_id', p_card_id,
        'card_name', v_card_name,
        'card_slug', v_card_slug,
        'points_delta', -v_card_cost,
        'points_balance', v_new_balance,
        'already_processed', false
    );

end;
$$;


-- ============================================================
-- Security
-- ============================================================
--
-- The browser must never call this function directly.
-- FastAPI authenticates the user and calls it using service_role.
-- ============================================================

revoke all
on function public.purchase_card(
    uuid,
    bigint,
    text
)
from public;

revoke all
on function public.purchase_card(
    uuid,
    bigint,
    text
)
from anon;

revoke all
on function public.purchase_card(
    uuid,
    bigint,
    text
)
from authenticated;

grant execute
on function public.purchase_card(
    uuid,
    bigint,
    text
)
to service_role;