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
    if p_user_id is null then
        raise exception 'User id is required.';
    end if;

    if p_card_id is null then
        raise exception 'Card id is required.';
    end if;

    if (
        p_idempotency_key is null
        or length(trim(p_idempotency_key)) = 0
    ) then
        raise exception 'Idempotency key is required.';
    end if;


    -- Prevent two requests with the same key from
    -- being processed at the same time.
    perform pg_advisory_xact_lock(
        hashtextextended(
            p_idempotency_key,
            0
        )
    );


    -- ========================================================
    -- IDEMPOTENCY
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
        if (
            v_existing_user_id <> p_user_id
            or v_existing_card_id is distinct from p_card_id
            or v_existing_event_type <> 'card_purchase'
        ) then
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
            'reward_id',
            v_existing_event_id,

            'user_id',
            p_user_id,

            'card_id',
            p_card_id,

            'card_name',
            v_card_name,

            'card_slug',
            v_card_slug,

            'points_delta',
            v_existing_points_delta,

            'points_balance',
            v_current_balance,

            'already_processed',
            true
        );
    end if;


    -- ========================================================
    -- CARD
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
    where id = p_card_id;


    if not found then
        raise exception 'Card not found.';
    end if;


    if v_card_active is not true then
        raise exception 'Card is not active.';
    end if;


    if v_unlock_method <> 'points' then
        raise exception
            'Card cannot be purchased with points.';
    end if;


    -- ========================================================
    -- PROFILE / BALANCE LOCK
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
    -- OWNERSHIP
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
    -- BALANCE
    -- ========================================================

    if v_current_balance < v_card_cost then
        raise exception
            'Insufficient points balance.';
    end if;


    v_new_balance :=
        v_current_balance - v_card_cost;


    -- ========================================================
    -- ASSIGN CARD
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
    -- UPDATE BALANCE
    -- ========================================================

    update public.profiles
    set
        points_balance = v_new_balance,
        updated_at = now()
    where id = p_user_id;


    -- ========================================================
    -- LEDGER
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
            'card_name',
            v_card_name,

            'card_slug',
            v_card_slug,

            'cost',
            v_card_cost,

            'unlock_method',
            v_unlock_method
        )
    )
    returning id
    into v_reward_id;


    return jsonb_build_object(
        'reward_id',
        v_reward_id,

        'user_id',
        p_user_id,

        'card_id',
        p_card_id,

        'card_name',
        v_card_name,

        'card_slug',
        v_card_slug,

        'points_delta',
        -v_card_cost,

        'points_balance',
        v_new_balance,

        'already_processed',
        false
    );
end;
$$;


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
