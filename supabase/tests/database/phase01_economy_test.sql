-- Run only on a disposable LOCAL Supabase project. The isolated runner also
-- exercises this file after a clean install and after the 611822e upgrade.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.test_user(n integer) returns uuid language sql immutable as $$
    select ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.test_attempt(n integer) returns uuid language sql immutable as $$
    select ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.card_id(s text) returns bigint language sql stable as $$
    select id from public.cards where slug = s;
$$;
create function pg_temp.buy(n integer, s text, k text) returns jsonb
language sql as $$
    select public.purchase_card(pg_temp.test_user(n), pg_temp.card_id(s), k);
$$;
create function pg_temp.error_state(command text) returns text language plpgsql as $$
begin
    execute command;
    return '00000';
exception when others then return sqlstate;
end;
$$;
do $$ begin
    execute format('grant usage on schema %I to anon, authenticated, service_role',
        pg_my_temp_schema()::regnamespace::text);
end $$;
grant execute on function pg_temp.test_user(integer), pg_temp.test_attempt(integer),
    pg_temp.card_id(text), pg_temp.buy(integer,text,text), pg_temp.error_state(text)
    to anon, authenticated, service_role;

insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.test_user(n), 'phase01-' || n || '@example.invalid',
    jsonb_build_object('username', 'phase01_' || n)
from generate_series(1, 8) n;
update public.profiles set points_balance = 1000
    where id in (select pg_temp.test_user(n) from generate_series(1, 8) n);
-- Explicit funding fixtures allow balance/ledger reconciliation assertions.
insert into public.reward_events (user_id, event_type, points_delta, idempotency_key)
select pg_temp.test_user(n), 'test_funding', 1000, 'phase01-funding-' || n
from generate_series(1, 8) n;
insert into public.activity_attempts (id, user_id, activity_type)
values
    (pg_temp.test_attempt(1), pg_temp.test_user(1), 'game'),
    (pg_temp.test_attempt(2), pg_temp.test_user(2), 'game'),
    (pg_temp.test_attempt(3), pg_temp.test_user(2), 'game'),
    (pg_temp.test_attempt(4), pg_temp.test_user(1), 'ar'),
    (pg_temp.test_attempt(5), pg_temp.test_user(5), 'game'),
    (pg_temp.test_attempt(6), pg_temp.test_user(5), 'ar');

select is((select count(*) from public.teams), 4::bigint, 'four teams');
select is((select count(*) from public.cards), 20::bigint, 'twenty cards');
select is((select count(*) from (select team_id from public.cards group by team_id
    having count(*) = 5) s), 4::bigint, 'five cards for every team');
select is((select count(*) - count(distinct slug) from public.teams), 0::bigint, 'unique team slugs');
select is((select count(*) - count(distinct slug) from public.cards), 0::bigint, 'unique card slugs');
select is((select count(*) from public.cards where card_type = 'mascot'
    and unlock_method = 'ar' and cost = 0), 4::bigint, 'four AR-only mascots');
select is((select count(*) from public.cards where cost <> case card_type
    when 'team' then 250 when 'player' then 300 when 'mvp_player' then 500
    when 'mascot' then 0 end), 0::bigint, 'card prices remain unchanged');
select is(pg_temp.error_state($q$update public.cards set unlock_method = 'points'
    where slug = 'perro-sultan'$q$), '23514', 'mascot invariant is enforced by SQL');

select isnt(public.reward_operation_key(pg_temp.test_user(1), 'card_purchase', 'same'),
    public.reward_operation_key(pg_temp.test_user(2), 'card_purchase', 'same'), 'user namespaces differ');
select isnt(public.reward_operation_key(pg_temp.test_user(1), 'card_purchase', 'same'),
    public.reward_operation_key(pg_temp.test_user(1), 'activity:game:win', 'same'), 'operation namespaces differ');
select is(public.reward_operation_key(pg_temp.test_user(1), 'card_purchase', 'same'),
    public.reward_operation_key(pg_temp.test_user(1), 'card_purchase', 'same'), 'stable request identity');

set local role service_role;
select is((pg_temp.buy(1, 'sultanes-de-monterrey', 'shared')->>'points_balance')::int,
    750, 'purchase debits the configured 250 points');
select is((pg_temp.buy(1, 'sultanes-de-monterrey', 'shared')->>'already_processed')::boolean,
    true, 'lost response retry returns prior purchase');
select is((pg_temp.buy(2, 'sultanes-de-monterrey', 'shared')->>'points_balance')::int,
    750, 'another user can use the same request key');
select throws_ok($q$select pg_temp.buy(1, 'josh-lester', 'shared')$q$,
    'P0001', 'Idempotency key belongs to another operation.', 'same request cannot buy a different card');
select throws_ok($q$select pg_temp.buy(1, 'sultanes-de-monterrey', 'new-key')$q$,
    'P0001', 'Card already owned.', 'different request cannot buy an owned card');
select throws_ok($q$select pg_temp.buy(1, 'perro-sultan', 'mascot')$q$,
    'P0001', 'Card cannot be purchased with points.', 'AR mascot cannot be purchased');
select throws_ok($q$select public.purchase_card(pg_temp.test_user(1), -1, 'missing')$q$,
    'P0001', 'Card not found.', 'invalid card rejected');
select throws_ok($q$select public.purchase_card(pg_temp.test_user(1), 9223372036854775807, 'missing')$q$,
    'P0001', 'Card not found.', 'nonexistent card rejected');
select is((select count(*) from public.user_cards where user_id = pg_temp.test_user(1)),
    1::bigint, 'one inventory row after purchase retry');
select is((select count(*) from public.reward_events where user_id = pg_temp.test_user(1)
    and event_type = 'card_purchase'), 1::bigint, 'one purchase ledger event');
reset role;

update public.profiles set points_balance = 0 where id = pg_temp.test_user(4);
update public.cards set is_active = false where slug = 'gustavo-nunez';
set local role service_role;
select throws_ok($q$select pg_temp.buy(4, 'josh-lester', 'poor')$q$,
    'P0001', 'Insufficient points balance.', 'insufficient balance rejected');
select throws_ok($q$select pg_temp.buy(1, 'gustavo-nunez', 'inactive')$q$,
    'P0001', 'Card is not active.', 'inactive card rejected');
reset role;
update public.cards set is_active = true where slug = 'gustavo-nunez';
-- Restore funding to its initial value for reconciliation later.
update public.profiles set points_balance = 1000 where id = pg_temp.test_user(4);

-- Force an error AFTER the inventory/balance writes in purchase, and AFTER
-- the attempt update in completion. pgTAP catches in a subtransaction.
create function pg_temp.fail_ledger() returns trigger language plpgsql as $$
begin
    if new.idempotency_version = 2 and (
        new.metadata->>'card_slug' = 'josh-lester' or new.event_type = 'phase01_rollback'
    ) then raise exception 'phase01 forced failure'; end if;
    return new;
end;
$$;
create trigger phase01_fail_ledger before insert on public.reward_events
    for each row execute function pg_temp.fail_ledger();
set local role service_role;
select throws_ok($q$select pg_temp.buy(1, 'josh-lester', 'rollback')$q$,
    'P0001', 'phase01 forced failure', 'intermediate purchase failure is surfaced');
select throws_ok($q$select public.complete_activity_attempt(pg_temp.test_user(1),
    pg_temp.test_attempt(1), 'phase01_rollback', 'rollback', 1, 20)$q$,
    'P0001', 'phase01 forced failure', 'intermediate completion failure is surfaced');
select is((select points_balance from public.profiles where id = pg_temp.test_user(1)),
    750, 'failed writes do not change balance');
select is((select count(*) from public.user_cards where user_id = pg_temp.test_user(1)),
    1::bigint, 'failed purchase rolls back inventory');
select is((select status from public.activity_attempts where id = pg_temp.test_attempt(1)),
    'started', 'failed completion rolls back attempt status');
select is((select count(*) from public.reward_events where user_id = pg_temp.test_user(1)),
    2::bigint, 'failed operations leave no ledger entries');
reset role;
drop trigger phase01_fail_ledger on public.reward_events;

set local role service_role;
select is((public.complete_activity_attempt(pg_temp.test_user(1), pg_temp.test_attempt(1),
    'game_win', 'shared', 1, 20)->>'points_balance')::int, 770, 'game does not collide with purchase');
select is((public.complete_activity_attempt(pg_temp.test_user(1), pg_temp.test_attempt(1),
    'game_win', 'shared', 1, 20)->>'already_processed')::boolean, true, 'completion retry is idempotent');
select throws_ok($q$select public.complete_activity_attempt(pg_temp.test_user(1),
    pg_temp.test_attempt(1), 'game_win', 'shared', 2, 20)$q$,
    'P0001', 'Economic operation state is inconsistent.', 'retry cannot change the original score');
select is((public.complete_activity_attempt(pg_temp.test_user(1), pg_temp.test_attempt(4),
    'game_win', 'shared', 1, 20)->>'points_balance')::int, 790, 'different activity type has its own scope');
select throws_ok($q$select public.complete_activity_attempt(pg_temp.test_user(1),
    pg_temp.test_attempt(2), 'game_win', 'shared', 1, 20)$q$,
    'P0001', 'Activity attempt not found.', 'foreign attempt cannot be completed');
select throws_ok($q$select public.complete_activity_attempt(pg_temp.test_user(1),
    pg_temp.test_attempt(1), 'game_win', 'shared', 1, 21)$q$,
    'P0001', 'Idempotency key belongs to another operation.', 'retry cannot change points');
select throws_ok($q$select public.complete_activity_attempt(pg_temp.test_user(1),
    pg_temp.test_attempt(1), 'another_type', 'shared', 1, 20)$q$,
    'P0001', 'Activity attempt cannot be completed.', 'another type cannot re-complete an attempt');
select throws_ok($q$select public.complete_activity_attempt(pg_temp.test_user(2),
    pg_temp.test_attempt(2), 'game_win', 'negative', 1, -20)$q$,
    'P0001', 'Activity rewards and score must be nonnegative.', 'activity cannot debit points');
select throws_ok($q$select public.complete_activity_attempt(pg_temp.test_user(2),
    pg_temp.test_attempt(2), 'card_purchase', 'fake-buy', 1, 20)$q$,
    'P0001', 'Activity event type is invalid.', 'generic completion cannot impersonate purchase');
select throws_ok($q$select public.complete_activity_attempt(pg_temp.test_user(2),
    null, 'game_win', 'null', 1, 20)$q$,
    'P0001', 'User and activity attempt are required.', 'NULL attempt rejected');
reset role;

-- Historical malformed event: NULL is never considered equal to an attempt.
insert into public.reward_events (user_id, event_type, points_delta, idempotency_key)
    values (pg_temp.test_user(2), 'phase01_null', 0, 'legacy-null');
set local role service_role;
select throws_ok($q$select public.complete_activity_attempt(pg_temp.test_user(2),
    pg_temp.test_attempt(2), 'phase01_null', 'legacy-null', 0, 0)$q$,
    'P0001', 'Idempotency key belongs to another operation.', 'legacy NULL identity fails closed');
select is((select status from public.activity_attempts where id = pg_temp.test_attempt(2)),
    'started', 'NULL collision does not complete attempt');
select is((public.complete_activity_attempt(pg_temp.test_user(2), pg_temp.test_attempt(2),
    'game_win', 'shared', 1, 20)->>'points_balance')::int, 770, 'same completion request is independent between users');
select throws_ok($q$select public.complete_activity_attempt(pg_temp.test_user(2),
    pg_temp.test_attempt(3), 'game_win', 'shared', 1, 20)$q$,
    'P0001', 'Idempotency key belongs to another operation.', 'same completion request cannot target another attempt');
reset role;

-- A historical purchase can neither reserve nor confirm today's trivia.
do $$ begin
    perform public.get_or_create_daily_trivia(current_date);
    perform public.get_or_create_daily_trivia_attempt(pg_temp.test_user(3),
        (select id from public.daily_trivias where trivia_date = current_date));
end $$;
insert into public.user_cards (user_id, card_id, source)
    values (pg_temp.test_user(3), pg_temp.card_id('sultanes-de-monterrey'), 'points');
update public.profiles set points_balance = 750 where id = pg_temp.test_user(3);
insert into public.reward_events (user_id, event_type, points_delta, card_id, idempotency_key)
select pg_temp.test_user(3), 'card_purchase', -250, pg_temp.card_id('sultanes-de-monterrey'),
    'daily-trivia:' || id::text || ':' || pg_temp.test_user(3)::text
from public.daily_trivias where trivia_date = current_date;
insert into public.trivia_attempt_answers (attempt_id, question_id, selected_option_id)
select a.id, q.question_id, o.id
from public.activity_attempts a
join public.daily_trivia_questions q on q.daily_trivia_id = a.daily_trivia_id
join public.trivia_options o on o.question_id = q.question_id and o.is_correct
where a.user_id = pg_temp.test_user(3);
create function pg_temp.finish_daily(n integer) returns jsonb language sql as $$
    select public.complete_daily_trivia_attempt(pg_temp.test_user(n), a.id,
        a.daily_trivia_id, t.trivia_date)
    from public.activity_attempts a join public.daily_trivias t on t.id = a.daily_trivia_id
    where a.user_id = pg_temp.test_user(n) and t.trivia_date = current_date;
$$;
grant execute on function pg_temp.finish_daily(integer) to service_role;
set local role service_role;
select is((pg_temp.finish_daily(3)->>'points_earned')::int, 100, 'H03 legacy purchase collision credits the real trivia');
select is((pg_temp.finish_daily(3)->>'already_processed')::boolean, true, 'daily retry returns its own completion');
select is((select points_balance from public.profiles where id = pg_temp.test_user(3)),
    850, 'daily reward is credited once');
select is((select status from public.activity_attempts where user_id = pg_temp.test_user(3)),
    'completed', 'trivia ends completed, not stuck started');
select is((select count(*) from public.reward_events where user_id = pg_temp.test_user(3)
    and event_type = 'daily_trivia_completion'), 1::bigint, 'single daily ledger event');
reset role;

-- Legitimate historical retry: no rewriting, no duplicate credit.
update public.activity_attempts set status = 'completed', score = 1, completed_at = now()
    where id = pg_temp.test_attempt(5);
update public.profiles set points_balance = 1020 where id = pg_temp.test_user(5);
insert into public.reward_events (user_id, attempt_id, event_type, points_delta, idempotency_key)
    values (pg_temp.test_user(5), pg_temp.test_attempt(5), 'game_win', 20, 'old-game');
set local role service_role;
select is((public.complete_activity_attempt(pg_temp.test_user(5), pg_temp.test_attempt(5),
    'game_win', 'old-game', 1, 20)->>'points_balance')::int, 1020, 'legacy valid completion does not credit again');
select is((public.complete_activity_attempt(pg_temp.test_user(5), pg_temp.test_attempt(6),
    'game_win', 'old-game', 1, 20)->>'points_balance')::int, 1040, 'legacy game request does not reserve a different activity type');
select is((pg_temp.buy(3, 'sultanes-de-monterrey', (select idempotency_key from public.reward_events
    where user_id = pg_temp.test_user(3) and event_type = 'card_purchase'))->>'already_processed')::boolean,
    true, 'legacy valid purchase retry is retained');
reset role;

-- An arbitrary historical string equal to a computed internal key cannot
-- squat the version-2 namespace, even if its user/type is unrelated.
insert into public.reward_events (user_id, event_type, points_delta, idempotency_key)
    values (pg_temp.test_user(6), 'legacy', 0,
        public.reward_operation_key(pg_temp.test_user(7), 'card_purchase', 'squatted'));
set local role service_role;
select is((pg_temp.buy(7, 'sultanes-de-monterrey', 'squatted')->>'points_balance')::int,
    750, 'legacy strings cannot reserve internal v2 keys');
reset role;

-- A different account may reuse a historical client request as well.
insert into public.user_cards(user_id,card_id,source)
    values (pg_temp.test_user(6), pg_temp.card_id('sultanes-de-monterrey'), 'points');
update public.profiles set points_balance = 750 where id = pg_temp.test_user(6);
insert into public.reward_events(user_id,event_type,points_delta,card_id,idempotency_key)
    values (pg_temp.test_user(6), 'card_purchase', -250,
        pg_temp.card_id('sultanes-de-monterrey'), 'legacy-shared');
set local role service_role;
select is((pg_temp.buy(7, 'charros-de-jalisco', 'legacy-shared')->>'points_balance')::int,
    500, 'another user may reuse a historical request key');
reset role;

-- Fail closed even if a privileged/old writer recorded the wrong event type
-- under a key resembling the expected one. No repair is performed implicitly.
insert into public.reward_events(user_id,attempt_id,event_type,points_delta,idempotency_key,idempotency_version)
    values (pg_temp.test_user(2), pg_temp.test_attempt(3), 'wrong_type', 0,
        public.reward_operation_key(pg_temp.test_user(2), 'activity:game:game_win', 'wrong-type'), 2);
set local role service_role;
select throws_ok($q$select public.complete_activity_attempt(pg_temp.test_user(2),
    pg_temp.test_attempt(3), 'game_win', 'wrong-type', 0, 0)$q$,
    'P0001', 'Idempotency key belongs to another operation.', 'wrong event type cannot confirm completion');
select is((select status from public.activity_attempts where id=pg_temp.test_attempt(3)),
    'started', 'wrong event type leaves attempt unchanged');
reset role;
select is(pg_temp.error_state($q$insert into public.reward_events(user_id,event_type,points_delta,
    idempotency_key,idempotency_version) values (pg_temp.test_user(2),'game_win',20,'v2-null',2)$q$),
    '23514', 'v2 activity event cannot contain NULL attempt');
select is(pg_temp.error_state($q$insert into public.user_cards(user_id,card_id)
    values (pg_temp.test_user(2),9223372036854775807)$q$), '23503', 'inventory foreign key remains enforced');

-- A legacy trivia event with a matching request cannot confirm a new purchase.
insert into public.reward_events (user_id, event_type, points_delta, idempotency_key)
    values (pg_temp.test_user(8), 'daily_trivia_completion', 0, 'other-operation');
set local role service_role;
select is((pg_temp.buy(8, 'sultanes-de-monterrey', 'other-operation')->>'already_processed')::boolean,
    false, 'legacy trivia is not interpreted as purchase');
reset role;

select is((select count(*) from public.profiles p where p.id in (
    select pg_temp.test_user(n) from generate_series(1, 8) n
) and p.points_balance <> (select coalesce(sum(e.points_delta), 0)
    from public.reward_events e where e.user_id = p.id)), 0::bigint, 'balances reconcile with fixture ledger');
select is((select count(*) from public.reward_events where idempotency_version = 1
    and idempotency_key = 'old-game'), 1::bigint, 'historical raw key is unchanged');

-- Real roles, permissions and RLS; no dependency overrides here.
select ok(not has_column_privilege('authenticated', 'public.profiles', 'points_balance', 'UPDATE'),
    'authenticated cannot update points');
select ok(not has_table_privilege('authenticated', 'public.user_cards', 'INSERT'), 'no client inventory insert grant');
select ok(not has_table_privilege('authenticated', 'public.reward_events', 'INSERT'), 'no client ledger insert grant');
select ok(has_column_privilege('service_role', 'public.profiles', 'points_balance', 'UPDATE'), 'server can update balance');
select ok(has_column_privilege('service_role', 'public.profiles', 'updated_at', 'UPDATE'), 'server can update timestamp');
select ok(has_table_privilege('service_role', 'public.user_cards', 'INSERT'), 'server can grant inventory');
select ok(not has_function_privilege('anon', 'public.purchase_card(uuid,bigint,text)', 'EXECUTE'), 'anon cannot purchase RPC');
select ok(not has_function_privilege('authenticated', 'public.purchase_card(uuid,bigint,text)', 'EXECUTE'), 'client cannot purchase RPC');
select ok(not has_function_privilege('authenticated', 'public.complete_activity_attempt(uuid,uuid,text,text,integer,integer,jsonb)', 'EXECUTE'), 'client cannot award RPC');
select ok(not has_function_privilege('anon', 'public.complete_daily_trivia_attempt(uuid,uuid,uuid,date)', 'EXECUTE'), 'anon cannot finalize trivia');
select ok(not has_function_privilege('authenticated', 'public.reward_operation_key(uuid,text,text)', 'EXECUTE'), 'key helper not a client RPC');
select ok(not (select prosecdef from pg_proc where oid = 'public.purchase_card(uuid,bigint,text)'::regprocedure), 'purchase remains SECURITY INVOKER');
select ok(not (select prosecdef from pg_proc where oid = 'public.complete_activity_attempt(uuid,uuid,text,text,integer,integer,jsonb)'::regprocedure), 'completion remains SECURITY INVOKER');

set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.test_user(1)::text, true);
select is((select count(*) from public.profiles), 1::bigint, 'RLS only shows own profile');
select is((select count(*) from public.user_cards where user_id = pg_temp.test_user(2)),
    0::bigint, 'RLS hides foreign inventory');
select is(pg_temp.error_state($q$update public.profiles set points_balance = 99999$q$),
    '42501', 'balance update denied at runtime');
select is(pg_temp.error_state($q$insert into public.user_cards(user_id,card_id)
    values (pg_temp.test_user(1), pg_temp.card_id('josh-lester'))$q$), '42501', 'inventory insert denied at runtime');
select is(pg_temp.error_state($q$insert into public.reward_events(user_id,event_type,idempotency_key)
    values (pg_temp.test_user(1), 'fake', 'fake')$q$), '42501', 'ledger insert denied at runtime');
select is(pg_temp.error_state($q$select pg_temp.buy(1, 'josh-lester', 'client-rpc')$q$),
    '42501', 'direct purchase execution denied at runtime');
reset role;
set local role anon;
select is(pg_temp.error_state($q$select public.complete_activity_attempt(pg_temp.test_user(1),
    pg_temp.test_attempt(1), 'game_win', 'anon', 1, 99999)$q$), '42501', 'anonymous reward RPC denied at runtime');
select is(pg_temp.error_state($q$select * from public.profiles$q$), '42501', 'anonymous profile read denied');
reset role;

select * from finish();
rollback;
