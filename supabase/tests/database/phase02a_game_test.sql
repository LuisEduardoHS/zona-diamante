-- LOCAL only. Every fixture and permission change is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.guser(n integer) returns uuid language sql immutable as $$
    select ('40000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.error_state(command text) returns text language plpgsql as $$
begin
    execute command;
    return '00000';
exception when others then return sqlstate;
end;
$$;
create temporary table game_fixture(name text primary key, result jsonb not null);
create function pg_temp.gid(name text) returns uuid language sql stable as $$
    select (result->>'id')::uuid from game_fixture where game_fixture.name = $1;
$$;
do $$ begin
    execute format('grant usage on schema %I to anon, authenticated, service_role',
        pg_my_temp_schema()::regnamespace::text);
end $$;
grant all on game_fixture to service_role;
grant execute on function pg_temp.guser(integer), pg_temp.error_state(text), pg_temp.gid(text)
    to anon, authenticated, service_role;

insert into auth.users(id,email,raw_user_meta_data)
select pg_temp.guser(n), 'game-' || n || '@example.invalid',
    jsonb_build_object('username', 'game_' || n) from generate_series(1,2) n;

select ok(not has_function_privilege('anon', 'public.start_game_attempt(uuid,text,uuid)', 'EXECUTE'), 'anon cannot start by RPC');
select ok(not has_function_privilege('authenticated', 'public.start_game_attempt(uuid,text,uuid)', 'EXECUTE'), 'authenticated cannot spoof RPC identity');
select ok(not has_function_privilege('authenticated', 'public.transition_game_attempt(uuid,uuid,text,integer)', 'EXECUTE'), 'authenticated cannot transition by RPC');
select ok(has_function_privilege('service_role', 'public.start_game_attempt(uuid,text,uuid)', 'EXECUTE'), 'server can start');
select ok(has_function_privilege('service_role', 'public.transition_game_attempt(uuid,uuid,text,integer)', 'EXECUTE'), 'server can transition');
select ok((select relrowsecurity from pg_class where oid='public.activity_attempts'::regclass), 'attempt RLS remains enabled');

set local role service_role;
insert into game_fixture values ('first', public.start_game_attempt(pg_temp.guser(1),'same'));
select is((select result->>'game_state' from game_fixture where name='first'), 'active', 'start is active');
select is((select game_revision from public.activity_attempts where id=pg_temp.gid('first')), 0, 'initial revision zero');
select is((select status from public.activity_attempts where id=pg_temp.gid('first')), 'started', 'existing attempt contract preserved');
select ok((select score is null and completed_at is null from public.activity_attempts where id=pg_temp.gid('first')), 'no fabricated result');
select is(public.start_game_attempt(pg_temp.guser(1),'same')->>'id', pg_temp.gid('first')::text, 'start retry returns original ID');
insert into game_fixture values ('other', public.start_game_attempt(pg_temp.guser(2),'same'));
select isnt(pg_temp.gid('first'), pg_temp.gid('other'), 'same key is isolated by user');
select throws_ok($q$select public.start_game_attempt(null,'key')$q$, 'P0001', 'Invalid game request.', 'NULL user rejected');
select throws_ok($q$select public.start_game_attempt(pg_temp.guser(1),null)$q$, 'P0001', 'Invalid game request.', 'NULL key rejected');
select throws_ok($q$select public.start_game_attempt(pg_temp.guser(1),' ')$q$, 'P0001', 'Invalid game request.', 'empty key rejected');
select throws_ok($q$select public.start_game_attempt(pg_temp.guser(1),repeat('x',129))$q$, 'P0001', 'Invalid game request.', 'oversize key rejected');
select throws_ok($q$select public.start_game_attempt(pg_temp.guser(99),'key')$q$, 'P0001', 'Profile not found.', 'missing profile rejected');

select is(public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('first'),'pause',0)->>'game_state', 'paused', 'pause works');
select is(public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('first'),'pause',0)->>'game_revision', '1', 'duplicate pause does not increment');
select is((select status from public.activity_attempts where id=pg_temp.gid('first')), 'started', 'pause never completes');
select throws_ok($q$select public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('first'),'resume',0)$q$, 'P0001', 'Game transition conflict.', 'stale command rejected');
select is(public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('first'),'resume',1)->>'game_state', 'active', 'resume same session');
select is(public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('first'),'resume',1)->>'id', pg_temp.gid('first')::text, 'resume retry same ID');
select throws_ok($q$select public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('first'),'resume',2)$q$, 'P0001', 'Game transition conflict.', 'resume active rejected');
select throws_ok($q$select public.transition_game_attempt(pg_temp.guser(2),pg_temp.gid('first'),'pause',2)$q$, 'P0001', 'Game not found.', 'foreign transition concealed');
select throws_ok($q$select public.transition_game_attempt(pg_temp.guser(1),pg_temp.guser(99),'pause',0)$q$, 'P0001', 'Game not found.', 'missing ID concealed identically');
select throws_ok($q$select public.start_game_attempt(pg_temp.guser(2),'foreign',pg_temp.gid('first'))$q$, 'P0001', 'Game not found.', 'foreign restart denied');
select is((select game_revision from public.activity_attempts where id=pg_temp.gid('first')), 2, 'rejections leave owner state intact');
select throws_ok($q$select public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('first'),'win',2)$q$, 'P0001', 'Invalid game request.', 'no win command');
select throws_ok($q$select public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('first'),null,2)$q$, 'P0001', 'Invalid game request.', 'NULL action rejected');
select throws_ok($q$select public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('first'),'pause',null)$q$, 'P0001', 'Invalid game request.', 'NULL revision rejected');
select throws_ok($q$select public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('first'),'pause',-1)$q$, 'P0001', 'Invalid game request.', 'negative revision rejected');

insert into game_fixture values ('restart', public.start_game_attempt(pg_temp.guser(1),'same',pg_temp.gid('first')));
select isnt(pg_temp.gid('restart'), pg_temp.gid('first'), 'explicit restart creates a new server ID');
select is((select game_state from public.activity_attempts where id=pg_temp.gid('first')), 'abandoned', 'restart abandons original');
select is((select status from public.activity_attempts where id=pg_temp.gid('first')), 'rejected', 'abandon is not completion');
select ok((select completed_at is not null and score is null from public.activity_attempts where id=pg_temp.gid('first')), 'abandon timestamp without score');
select is((select game_revision from public.activity_attempts where id=pg_temp.gid('restart')), 0, 'restart has fresh revision');
select is(public.start_game_attempt(pg_temp.guser(1),'same',pg_temp.gid('first'))->>'id', pg_temp.gid('restart')::text, 'restart retry returns one successor');
select throws_ok($q$select public.start_game_attempt(pg_temp.guser(1),'different',pg_temp.gid('first'))$q$, 'P0001', 'Game already restarted.', 'new key cannot restart original twice');
select is(public.start_game_attempt(pg_temp.guser(1),'same')->>'game_state', 'abandoned', 'old start retry does not reopen terminal session');
select throws_ok($q$select public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('first'),'resume',3)$q$, 'P0001', 'Game transition conflict.', 'terminal game cannot resume');
select is(public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('restart'),'abandon',0)->>'game_state', 'abandoned', 'explicit abandon');
select is(public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('restart'),'abandon',0)->>'game_revision', '1', 'duplicate terminal action idempotent');
select throws_ok($q$select public.transition_game_attempt(pg_temp.guser(1),pg_temp.gid('restart'),'pause',1)$q$, 'P0001', 'Game transition conflict.', 'no actions after ending');

-- Generic metadata cannot impersonate a session created by the managed RPC.
insert into public.activity_attempts(id,user_id,activity_type,metadata)
values (pg_temp.guser(10),pg_temp.guser(1),'game','{"game_state":"active","win":true}');
select throws_ok($q$select public.transition_game_attempt(pg_temp.guser(1),pg_temp.guser(10),'pause',0)$q$, 'P0001', 'Game not found.', 'unmanaged attempt excluded');

select is(pg_temp.error_state($q$select public.complete_activity_attempt(pg_temp.guser(2),pg_temp.gid('other'),'game_win','fake',100,1000)$q$), '23514', 'generic economic completion cannot complete managed game');
select is(pg_temp.error_state($q$select public.complete_activity_attempt(pg_temp.guser(2),pg_temp.gid('other'),'daily_trivia_completion','fake-trivia',5,100)$q$), 'P0001', 'cannot masquerade as trivia');
select throws_ok($q$insert into public.reward_events(user_id,attempt_id,event_type,points_delta,idempotency_key)
    values(pg_temp.guser(2),pg_temp.gid('other'),'game_win',0,'direct-fake')$q$,
    'P0001', 'Game rewards are disabled pending server validation.', 'even zero-point direct event blocked');
select is((select points_balance from public.profiles where id=pg_temp.guser(2)), 0, 'failed completion rolls balance back');
select is((select game_state from public.activity_attempts where id=pg_temp.gid('other')), 'active', 'failed completion rolls attempt back');
select is((select count(*) from public.reward_events where user_id in (pg_temp.guser(1),pg_temp.guser(2))), 0::bigint, 'no reward events from any game action');
select is((select count(*) from public.user_cards where user_id in (pg_temp.guser(1),pg_temp.guser(2))), 0::bigint, 'no inventory from any game action');
select is(pg_temp.error_state($q$update public.activity_attempts set score=100 where id=pg_temp.gid('other')$q$), '23514', 'managed score prohibited');
select is(pg_temp.error_state($q$update public.activity_attempts set game_state='won' where id=pg_temp.gid('other')$q$), '23514', 'undefined terminal state prohibited');
select is(pg_temp.error_state($q$update public.activity_attempts set game_revision=null where id=pg_temp.gid('other')$q$), '23514', 'NULL revision cannot bypass shape');

reset role;
-- Force an insertion error AFTER abandoning to prove restart is one transaction.
create function pg_temp.fail_game_insert() returns trigger language plpgsql as $$
begin raise exception 'Forced local insertion failure.'; end;
$$;
create trigger test_fail_game_insert before insert on public.activity_attempts
    for each row execute function pg_temp.fail_game_insert();
select throws_ok($q$select public.start_game_attempt(pg_temp.guser(2),'rollback',pg_temp.gid('other'))$q$, 'P0001', 'Forced local insertion failure.', 'restart insertion failure propagated');
select is((select game_state from public.activity_attempts where id=pg_temp.gid('other')), 'active', 'failed restart rolls abandonment back');
drop trigger test_fail_game_insert on public.activity_attempts;

set local role anon;
select is(pg_temp.error_state($q$select public.start_game_attempt(pg_temp.guser(1),'spoof')$q$), '42501', 'anon RPC actually denied');
select is(pg_temp.error_state($q$insert into public.activity_attempts(user_id,activity_type) values(pg_temp.guser(1),'game')$q$), '42501', 'anon direct insert denied');
set local role authenticated;
select is(pg_temp.error_state($q$select public.transition_game_attempt(pg_temp.guser(1),pg_temp.guser(99),'pause',0)$q$), '42501', 'authenticated RPC actually denied');
select is(pg_temp.error_state($q$update public.profiles set points_balance=999 where id=pg_temp.guser(1)$q$), '42501', 'client cannot set balance');
select is(pg_temp.error_state($q$insert into public.reward_events(user_id,event_type,points_delta,idempotency_key) values(pg_temp.guser(1),'game_win',999,'spoof')$q$), '42501', 'client cannot insert rewards');
select is(pg_temp.error_state($q$select * from public.activity_attempts$q$), '42501', 'client cannot read raw sessions');
reset role;
select * from finish();
rollback;
