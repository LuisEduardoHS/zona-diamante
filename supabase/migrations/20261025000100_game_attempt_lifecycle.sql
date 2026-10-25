-- Managed game sessions reuse attempts. NULL columns preserve legacy/trivia/AR
-- contracts; client-supplied metadata never opts an attempt into this protocol.
alter table public.activity_attempts
    add column game_state text,
    add column game_revision integer,
    add column game_request_key text,
    add column game_parent_id uuid references public.activity_attempts(id),
    add constraint managed_game_shape check (
        (game_state is null and game_revision is null and game_request_key is null and game_parent_id is null)
        or
        (game_state is not null and activity_type = 'game'
         and game_revision is not null and game_revision >= 0
         and game_request_key is not null and length(game_request_key) between 1 and 256
         and score is null
         and ((game_state in ('active', 'paused') and status = 'started' and completed_at is null)
              or (game_state = 'abandoned' and status = 'rejected' and completed_at is not null)))
    );

create unique index managed_game_request_unique
    on public.activity_attempts(user_id, game_request_key) where game_state is not null;
create unique index managed_game_restart_unique
    on public.activity_attempts(game_parent_id) where game_parent_id is not null;

create function public.start_game_attempt(
    p_user_id uuid, p_request_key text, p_restart_of uuid default null
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
    v_key text;
    v_attempt public.activity_attempts%rowtype;
    v_parent public.activity_attempts%rowtype;
begin
    if p_user_id is null or p_request_key is null
       or length(btrim(p_request_key)) not between 1 and 128 then
        raise exception 'Invalid game request.';
    end if;
    -- Same lock order as the economic RPCs; serialize retries/restarts per user.
    perform 1 from public.profiles where id = p_user_id for update;
    if not found then raise exception 'Profile not found.'; end if;
    v_key := public.reward_operation_key(p_user_id,
        'game:start:' || coalesce(p_restart_of::text, 'new'), btrim(p_request_key));
    select * into v_attempt from public.activity_attempts
        where user_id = p_user_id and game_request_key = v_key and game_state is not null;
    if found then return to_jsonb(v_attempt); end if;

    if p_restart_of is not null then
        select * into v_parent from public.activity_attempts
            where id = p_restart_of and user_id = p_user_id
              and activity_type = 'game' and game_state is not null for update;
        if not found then raise exception 'Game not found.'; end if;
        if exists (select 1 from public.activity_attempts where game_parent_id = p_restart_of) then
            raise exception 'Game already restarted.';
        end if;
        if v_parent.game_state in ('active', 'paused') then
            update public.activity_attempts set game_state = 'abandoned', status = 'rejected',
                completed_at = now(), game_revision = game_revision + 1 where id = p_restart_of;
        end if;
    end if;

    insert into public.activity_attempts(user_id, activity_type, game_state,
        game_revision, game_request_key, game_parent_id)
        values (p_user_id, 'game', 'active', 0, v_key, p_restart_of) returning * into v_attempt;
    return to_jsonb(v_attempt);
end;
$$;

create function public.transition_game_attempt(
    p_user_id uuid, p_attempt_id uuid, p_action text, p_expected_revision integer
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
    v_attempt public.activity_attempts%rowtype;
    v_target text;
begin
    if p_user_id is null or p_attempt_id is null or p_action is null
       or p_action not in ('pause', 'resume', 'abandon') or p_expected_revision is null
       or p_expected_revision < 0 or p_expected_revision > 2147483646 then
        raise exception 'Invalid game request.';
    end if;
    select * into v_attempt from public.activity_attempts
        where id = p_attempt_id and user_id = p_user_id
          and activity_type = 'game' and game_state is not null for update;
    if not found then raise exception 'Game not found.'; end if;
    v_target := case p_action when 'pause' then 'paused' when 'resume' then 'active' else 'abandoned' end;
    -- An exact retry observes the one committed transition, without incrementing.
    if v_attempt.game_revision = p_expected_revision + 1 and v_attempt.game_state = v_target then
        return to_jsonb(v_attempt);
    end if;
    if v_attempt.game_revision <> p_expected_revision
       or v_attempt.game_state = 'abandoned'
       or (p_action = 'pause' and v_attempt.game_state <> 'active')
       or (p_action = 'resume' and v_attempt.game_state <> 'paused') then
        raise exception 'Game transition conflict.';
    end if;
    update public.activity_attempts set game_state = v_target, game_revision = game_revision + 1,
        status = case when v_target = 'abandoned' then 'rejected' else 'started' end,
        completed_at = case when v_target = 'abandoned' then now() else null end
        where id = p_attempt_id returning * into v_attempt;
    return to_jsonb(v_attempt);
end;
$$;

-- Defence against accidentally using the privileged generic reward RPC on a
-- managed game. Even a zero-point or legacy event must not record a fake win.
create function public.block_unvalidated_game_reward()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
    if exists (select 1 from public.activity_attempts
               where id = new.attempt_id and game_state is not null) then
        raise exception 'Game rewards are disabled pending server validation.';
    end if;
    return new;
end;
$$;
create trigger block_unvalidated_game_reward
    before insert or update on public.reward_events
    for each row execute function public.block_unvalidated_game_reward();

revoke all on function public.start_game_attempt(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.transition_game_attempt(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.block_unvalidated_game_reward() from public, anon, authenticated;
grant execute on function public.start_game_attempt(uuid, text, uuid) to service_role;
grant execute on function public.transition_game_attempt(uuid, uuid, text, integer) to service_role;
grant execute on function public.block_unvalidated_game_reward() to service_role;
