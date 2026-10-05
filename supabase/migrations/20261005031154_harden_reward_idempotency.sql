create or replace function public.complete_activity_attempt(
    p_user_id uuid,
    p_attempt_id uuid,
    p_event_type text,
    p_idempotency_key text,
    p_score integer default null,
    p_points_delta integer default 0,
    p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_attempt_status text;

    v_current_balance integer;
    v_new_balance integer;

    v_reward_id uuid;

    v_existing_reward_id uuid;
    v_existing_user_id uuid;
    v_existing_attempt_id uuid;
    v_existing_points_delta integer;
begin

    if p_idempotency_key is null
       or btrim(p_idempotency_key) = '' then
        raise exception 'Idempotency key is required.';
    end if;

    if p_event_type is null
       or btrim(p_event_type) = '' then
        raise exception 'Event type is required.';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(p_idempotency_key, 0)
    );


    select
        id,
        user_id,
        attempt_id,
        points_delta
    into
        v_existing_reward_id,
        v_existing_user_id,
        v_existing_attempt_id,
        v_existing_points_delta
    from public.reward_events
    where idempotency_key = p_idempotency_key;

    if found then

        if v_existing_user_id <> p_user_id
           or v_existing_attempt_id <> p_attempt_id then
            raise exception
                'Idempotency key belongs to another operation.';
        end if;

        select points_balance
        into v_current_balance
        from public.profiles
        where id = p_user_id;

        return jsonb_build_object(
            'reward_id', v_existing_reward_id,
            'attempt_id', p_attempt_id,
            'user_id', p_user_id,
            'points_delta', v_existing_points_delta,
            'points_balance', v_current_balance,
            'already_processed', true
        );
    end if;


    select status
    into v_attempt_status
    from public.activity_attempts
    where id = p_attempt_id
      and user_id = p_user_id
    for update;

    if not found then
        raise exception 'Activity attempt not found.';
    end if;

    if v_attempt_status <> 'started' then
        raise exception 'Activity attempt cannot be completed.';
    end if;


    select points_balance
    into v_current_balance
    from public.profiles
    where id = p_user_id
    for update;

    if not found then
        raise exception 'Profile not found.';
    end if;

    v_new_balance :=
        v_current_balance + p_points_delta;

    if v_new_balance < 0 then
        raise exception 'Insufficient points balance.';
    end if;


    update public.activity_attempts
    set
        status = 'completed',
        score = p_score,
        completed_at = now()
    where id = p_attempt_id
      and user_id = p_user_id;


    insert into public.reward_events (
        user_id,
        attempt_id,
        event_type,
        points_delta,
        idempotency_key,
        metadata
    )
    values (
        p_user_id,
        p_attempt_id,
        p_event_type,
        p_points_delta,
        p_idempotency_key,
        coalesce(p_metadata, '{}'::jsonb)
    )
    returning id
    into v_reward_id;


    update public.profiles
    set points_balance = v_new_balance
    where id = p_user_id;

    return jsonb_build_object(
        'reward_id', v_reward_id,
        'attempt_id', p_attempt_id,
        'user_id', p_user_id,
        'points_delta', p_points_delta,
        'points_balance', v_new_balance,
        'already_processed', false
    );

end;
$$;