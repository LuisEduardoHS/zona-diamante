-- Wrapped in BEGIN/ROLLBACK by check_game_buffered_database.py.
create temporary table buffered_fixture(uid uuid, rules jsonb);
insert into buffered_fixture select gen_random_uuid(),current_setting('zd_test.rules')::jsonb;
insert into auth.users(id,email,raw_user_meta_data)
select uid,'buffered-qa-'||uid||'@example.invalid',
    jsonb_build_object('username','buffered_'||replace(uid::text,'-','')) from buffered_fixture;
grant select on buffered_fixture to service_role;

create function pg_temp.inputs(hits integer, misses integer default 3) returns jsonb
language sql as $$
select jsonb_agg(jsonb_build_object('pitch',i,'at_ms',case when i<=hits
    then (public.survival_pitch_plan(i)->>'contactMs')::numeric else 0 end) order by i)
from generate_series(1,hits+misses) i;
$$;
create function pg_temp.must_fail(command text, expected text) returns void language plpgsql as $$
begin
    begin execute command;
    exception when others then
        if sqlerrm=expected then return; end if;
        raise exception 'Unexpected rejection: % (expected %)',sqlerrm,expected;
    end;
    raise exception 'Command was accepted instead of rejecting %',expected;
end $$;
do $$ begin execute format('grant usage on schema %I to service_role',pg_my_temp_schema()::regnamespace::text); end $$;
grant execute on function pg_temp.inputs(integer,integer),pg_temp.must_fail(text,text) to service_role;

set local role service_role;
do $$
declare
    uid uuid := (select f.uid from buffered_fixture f);
    rules jsonb := (select f.rules from buffered_fixture f);
    first jsonb; second jsonb; reply jsonb; inputs jsonb; another jsonb;
    gid uuid; second_id uuid; expected integer; game_no integer;
begin
    if has_function_privilege('anon','public.game_buffered_command(uuid,text,uuid,text,jsonb,jsonb)','EXECUTE')
        or has_function_privilege('authenticated','public.game_buffered_command(uuid,text,uuid,text,jsonb,jsonb)','EXECUTE') then
        raise exception 'Buffered reward RPC exposed to client roles.';
    end if;
    first:=public.game_buffered_command(uid,'start',p_key=>'first',p_rules=>rules);
    reply:=public.game_buffered_command(uid,'start',p_key=>'first',p_rules=>rules);
    if first->>'id' is distinct from reply->>'id' or first->>'transport'<>'buffered-1' then
        raise exception 'Reservation is not idempotent.';
    end if;
    gid:=(first->>'id')::uuid;
    second:=public.game_buffered_command(uid,'start',p_key=>'second',p_rules=>rules);
    second_id:=(second->>'id')::uuid;
    if second_id=gid then raise exception 'Pending games reused an unrelated reservation.'; end if;

    inputs:=pg_temp.inputs(12);
    perform pg_temp.must_fail(format('select public.game_buffered_command(%L,%L,%L,p_events=>%L::jsonb)',uid,'complete',gid,inputs),'Buffered duration not reached.');
    update public.activity_attempts set beta_game=jsonb_set(beta_game,'{created_ms}',to_jsonb((beta_game->>'created_ms')::numeric-120000)) where id=gid and user_id=uid;
    perform pg_temp.must_fail(format('select public.game_buffered_command(%L,%L,%L,p_events=>%L::jsonb)',uid,'complete',gid,pg_temp.inputs(10,2)),'Incomplete buffered game.');
    perform pg_temp.must_fail(format('select public.game_buffered_command(%L,%L,%L,p_events=>%L::jsonb)',uid,'complete',gid,jsonb_set(inputs,'{0,pitch}','2')),'Invalid buffered inputs.');
    perform pg_temp.must_fail(format('select public.game_buffered_command(%L,%L,%L,p_events=>%L::jsonb)',uid,'complete',gid,jsonb_set(inputs,'{0,at_ms}','-1')),'Invalid buffered inputs.');
    perform pg_temp.must_fail(format('select public.game_buffered_command(%L,%L,%L,p_events=>%L::jsonb)',uid,'complete',gid,inputs||jsonb_build_array(jsonb_build_object('pitch',16,'at_ms',0))),'Invalid buffered inputs.');
    reply:=public.game_buffered_command(uid,'complete',gid,p_events=>inputs);
    if reply->>'phase'<>'completed' or (reply->'stats'->>'hits')::int<>12
        or (reply->'stats'->>'misses')::int<>3 or (reply->'reward'->>'points_awarded')::int<>50 then
        raise exception 'Server replay or reward calculation mismatch.';
    end if;
    reply:=public.game_buffered_command(uid,'complete',gid,p_events=>inputs);
    if (reply->>'points_balance')::int<>50 or (select count(*) from public.reward_events where user_id=uid)<>1 then
        raise exception 'Duplicate points after retry.';
    end if;
    perform pg_temp.must_fail(format('select public.game_buffered_command(%L,%L,%L,p_events=>%L::jsonb)',uid,'complete',gid,jsonb_set(inputs,'{0,at_ms}','0')),'Beta key conflict.');
    -- The second reservation was already issued while the first was pending.
    update public.activity_attempts set beta_game=jsonb_set(beta_game,'{created_ms}',to_jsonb((beta_game->>'created_ms')::numeric-120000)) where id=second_id and user_id=uid;
    reply:=public.game_buffered_command(uid,'complete',second_id,p_events=>pg_temp.inputs(15));
    if (reply->'reward'->>'points_awarded')::int<>65 then raise exception 'Reward cap mismatch.'; end if;
    for game_no in 3..4 loop
        reply:=public.game_buffered_command(uid,'start',p_key=>'cap-'||game_no,p_rules=>rules);
        gid:=(reply->>'id')::uuid;
        update public.activity_attempts set beta_game=jsonb_set(beta_game,'{created_ms}',to_jsonb((beta_game->>'created_ms')::numeric-120000)) where id=gid and user_id=uid;
        reply:=public.game_buffered_command(uid,'complete',gid,p_events=>pg_temp.inputs(10));
        expected:=case when game_no=3 then 40 else 0 end;
        if (reply->'reward'->>'points_awarded')::int<>expected then raise exception 'Daily reward cap changed.'; end if;
    end loop;
    if reply->'reward'->>'status'<>'daily_limit' or (reply->>'points_balance')::int<>155 then
        raise exception 'Daily quota or balance mismatch.';
    end if;
    reply:=public.game_buffered_command(uid,'start',p_key=>'passive',p_rules=>rules);
    gid:=(reply->>'id')::uuid;
    update public.activity_attempts set beta_game=jsonb_set(beta_game,'{created_ms}',to_jsonb((beta_game->>'created_ms')::numeric-120000)) where id=gid and user_id=uid;
    inputs:='[{"pitch":1,"at_ms":null},{"pitch":2,"at_ms":null},{"pitch":3,"at_ms":null}]'::jsonb;
    reply:=public.game_buffered_command(uid,'complete',gid,p_events=>inputs);
    if reply->'reward'->>'status'<>'no_participation' or (reply->>'points_balance')::int<>155 then
        raise exception 'Passive game credited points.';
    end if;
    reply:=public.game_buffered_command(uid,'start',p_key=>'expired',p_rules=>rules);
    gid:=(reply->>'id')::uuid;
    update public.activity_attempts set beta_game=jsonb_set(beta_game,'{expires_at}','0') where id=gid and user_id=uid;
    reply:=public.game_buffered_command(uid,'complete',gid,p_events=>inputs);
    if reply->>'phase'<>'expired' then raise exception 'Expired reservation accepted.'; end if;
end $$;
select 'PASS: replay, input validation, wall-clock bounds, pending games, retries, expiry and daily reward limits' as result;
