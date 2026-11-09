-- Reserve once, play on the device, validate the recorded inputs at completion.
-- Timing inputs describe play; the server always recomputes results and points.
-- Preserve live sessions and their protocol. Buffered reservations can coexist
-- while a completed local game waits for its connection to recover.
drop index public.beta_game_one_active;
create unique index beta_game_one_active on public.activity_attempts(user_id)
where beta_game->>'phase' in ('waiting','pitch','paused','ready')
  and coalesce(beta_game->>'transport','live') <> 'buffered-1';

create function public.game_buffered_command(
    p_user_id uuid, p_action text, p_attempt_id uuid default null,
    p_key text default null, p_events jsonb default null, p_rules jsonb default null
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
    a public.activity_attempts%rowtype; g jsonb; e jsonb; plan jsonb;
    v_key text; digest text; kind text; idx integer:=0;
    at_ms numeric; cursor_ms numeric:=3000; duration_ms numeric;
    now_ms numeric:=extract(epoch from clock_timestamp())*1000;
begin
    if p_user_id is null or p_action not in ('start','read','complete') then
        raise exception 'Invalid buffered command.';
    end if;
    perform 1 from public.profiles where id=p_user_id for update;
    if not found then raise exception 'Profile not found.'; end if;
    if p_action='start' then
        if p_key is null or length(btrim(p_key)) not between 1 and 128
            or p_rules->>'version' is distinct from 'survival-1' then
            raise exception 'Invalid buffered command.';
        end if;
        v_key:=public.reward_operation_key(p_user_id,'game:buffered:start',btrim(p_key));
        select * into a from public.activity_attempts
        where user_id=p_user_id and beta_request_key=v_key for update;
        if not found then
            if (select count(*) from public.activity_attempts where user_id=p_user_id
                and beta_game is not null and started_at>clock_timestamp()-interval '1 hour')>=30 then
                raise exception 'Beta start rate limit.';
            end if;
            g:=jsonb_build_object('version','survival-1','mode','survival','transport','buffered-1',
                'phase','waiting','revision',0,'rules',p_rules,'created_ms',now_ms,
                'expires_at',now_ms+172800000,'next_at',now_ms,'history','[]'::jsonb,'ops','{}'::jsonb,
                'probe',gen_random_uuid(),'samples','[]'::jsonb,'compensation_ms',0,
                'stats',jsonb_build_object('resolved',0,'hits',0,'misses',0,'perfects',0,
                    'score',0,'streak',0,'bestStreak',0,'swings',0),
                'outcome',null,'last',null,'reward',jsonb_build_object('status','pending','points_awarded',null));
            insert into public.activity_attempts(user_id,activity_type,beta_game,beta_request_key,
                metadata) values(p_user_id,'game',g,v_key,jsonb_build_object('transport','buffered-1'))
            returning * into a;
        end if;
    else
        select * into a from public.activity_attempts where id=p_attempt_id and user_id=p_user_id
            and beta_game->>'transport'='buffered-1' for update;
        if not found then raise exception 'Beta not found.'; end if;
    end if;
    g:=a.beta_game;
    if p_action<>'complete' then
        return public.game_beta_command(p_user_id,'read',a.id);
    end if;
    if p_events is null or jsonb_typeof(p_events)<>'array'
        or jsonb_array_length(p_events) not between 3 and 10000 then
        raise exception 'Invalid buffered inputs.';
    end if;
    digest:=encode(sha256(convert_to(p_events::text,'UTF8')),'hex');
    if g->>'phase'='completed' then
        if g->>'buffered_digest' is distinct from digest then raise exception 'Beta key conflict.'; end if;
        return public.game_beta_command(p_user_id,'read',a.id);
    end if;
    if now_ms>(g->>'expires_at')::numeric then
        return public.game_beta_command(p_user_id,'read',a.id);
    end if;
    if g->>'phase'<>'waiting' or (g->'stats'->>'resolved')::int<>0
        or jsonb_array_length(g->'history')<>0 then raise exception 'Beta sequence conflict.'; end if;
    for e in select value from jsonb_array_elements(p_events) loop
        idx:=idx+1;
        if jsonb_typeof(e)<>'object' or (select count(*) from jsonb_object_keys(e))<>2
            or not e ?& array['pitch','at_ms'] or jsonb_typeof(e->'pitch')<>'number'
            or (e->>'pitch')::numeric<>idx or g->>'phase'='ready' then
            raise exception 'Invalid buffered inputs.';
        end if;
        plan:=public.survival_pitch_plan(idx);
        at_ms:=null;
        if jsonb_typeof(e->'at_ms')='null' then kind:='no_swing';
        elsif jsonb_typeof(e->'at_ms')='number' then
            at_ms:=(e->>'at_ms')::numeric;
            if at_ms<0 or at_ms>=(plan->>'flightMs')::numeric then raise exception 'Invalid buffered inputs.'; end if;
            kind:=case when abs(at_ms-(plan->>'contactMs')::numeric)<=(plan->>'perfectWindowMs')::numeric+.0000001 then 'perfect'
                when abs(at_ms-(plan->>'contactMs')::numeric)<=(plan->>'validWindowMs')::numeric+.0000001 then 'hit'
                when at_ms<(plan->>'contactMs')::numeric then 'early' else 'late' end;
        else raise exception 'Invalid buffered inputs.'; end if;
        g:=g||jsonb_build_object('plan',plan,'pitch_id',gen_random_uuid(),'pitch_start',cursor_ms);
        g:=public.beta_resolve(g,kind,cursor_ms+coalesce(at_ms,(plan->>'flightMs')::numeric));
        cursor_ms:=cursor_ms+coalesce(at_ms,(plan->>'flightMs')::numeric)
            +greatest(600,case when kind in ('hit','perfect') then 0
                else (plan->>'flightMs')::numeric-coalesce(at_ms,(plan->>'flightMs')::numeric) end);
    end loop;
    if g->>'phase'<>'ready' or (g->'stats'->>'misses')::int<>3 then
        raise exception 'Incomplete buffered game.';
    end if;
    duration_ms:=cursor_ms;
    if now_ms+250<(g->>'created_ms')::numeric+duration_ms then
        raise exception 'Buffered duration not reached.';
    end if;
    g:=g||jsonb_build_object('buffered_digest',digest,'buffered_duration_ms',duration_ms);
    update public.activity_attempts set beta_game=g where id=a.id;
    -- The established transaction enforces the daily cap, reward formula,
    -- account ownership and the unique ledger key for this game.
    return public.game_beta_command(p_user_id,'complete',a.id,'buffered:'||a.id::text);
end $$;

revoke all on function public.game_buffered_command(uuid,text,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.game_buffered_command(uuid,text,uuid,text,jsonb,jsonb) to service_role;
