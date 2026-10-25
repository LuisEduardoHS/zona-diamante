-- H02/H03. Keep historical keys and events byte-for-byte. Version 1 remains
-- unique within its historical namespace; version 2 keys are derived by SQL
-- from user + operation + request. Even a legacy key resembling a v2 key
-- cannot reserve a v2 operation. No economic writes are granted to clients.
alter table public.reward_events
    add column idempotency_version smallint not null default 1,
    add constraint reward_events_idempotency_version_check
        check (idempotency_version in (1, 2));

alter table public.reward_events
    drop constraint reward_events_idempotency_key_key,
    add constraint reward_events_version_key_unique
        unique (idempotency_version, idempotency_key),
    add constraint reward_events_v2_shape_check check (
        idempotency_version = 1 or (
            (event_type = 'card_purchase' and attempt_id is null
                and card_id is not null and points_delta <= 0)
            or (event_type <> 'card_purchase' and attempt_id is not null
                and card_id is null and points_delta >= 0)
        )
    );

-- A resource cannot be completed/purchased again under a different request.
-- Legacy rows remain untouched; the functions also validate legacy state.
create unique index reward_events_v2_purchase_resource_idx
    on public.reward_events (user_id, card_id)
    where idempotency_version = 2 and event_type = 'card_purchase';
create unique index reward_events_v2_attempt_resource_idx
    on public.reward_events (user_id, attempt_id)
    where idempotency_version = 2 and attempt_id is not null;

alter table public.cards add constraint cards_mascot_ar_only_check
    check (card_type <> 'mascot' or (unlock_method = 'ar' and cost = 0));

create function public.reward_operation_key(
    p_user_id uuid, p_operation text, p_request_key text
)
returns text
language sql immutable strict
set search_path = pg_catalog
as $$
    select 'zd:v2:' || p_user_id::text || ':' ||
        encode(sha256(convert_to(
            jsonb_build_array(p_operation, p_request_key)::text, 'UTF8'
        )), 'hex');
$$;

create or replace function public.purchase_card(
    p_user_id uuid, p_card_id bigint, p_idempotency_key text
)
returns jsonb
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare
    v_key text;
    v_request text := btrim(p_idempotency_key);
    v_balance integer;
    v_card public.cards%rowtype;
    v_event public.reward_events%rowtype;
begin
    if p_user_id is null then raise exception 'User id is required.'; end if;
    if p_card_id is null or p_card_id <= 0 then
        raise exception 'Card not found.';
    end if;
    if v_request is null or length(v_request) not between 1 and 128 then
        raise exception 'Idempotency key must contain between 1 and 128 characters.';
    end if;
    v_key := public.reward_operation_key(p_user_id, 'card_purchase', v_request);

    -- Shared economic lock order: profile -> attempt (if any) -> request lock.
    select points_balance into v_balance from public.profiles
        where id = p_user_id for update;
    if not found then raise exception 'Profile not found.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

    select * into v_event from public.reward_events
        where idempotency_version = 2 and idempotency_key = v_key;
    if not found then
        -- Only this user's same operation is a legacy retry. Foreign/type
        -- collisions are ignored, not returned or exposed to the caller.
        select * into v_event from public.reward_events
            where idempotency_version = 1 and idempotency_key = v_request
              and user_id = p_user_id and event_type = 'card_purchase';
    end if;

    if v_event.id is not null then
        if v_event.user_id is distinct from p_user_id
           or v_event.event_type is distinct from 'card_purchase'
           or v_event.card_id is distinct from p_card_id
           or v_event.attempt_id is not null
           or v_event.points_delta > 0 then
            raise exception 'Idempotency key belongs to another operation.';
        end if;
        if not exists (select 1 from public.user_cards
            where user_id = p_user_id and card_id = p_card_id) then
            raise exception 'Economic operation state is inconsistent.';
        end if;
        select * into v_card from public.cards where id = p_card_id;
        return jsonb_build_object(
            'reward_id', v_event.id, 'user_id', p_user_id,
            'card_id', p_card_id, 'card_name', v_card.name,
            'card_slug', v_card.slug, 'points_delta', v_event.points_delta,
            'points_balance', v_balance, 'already_processed', true
        );
    end if;

    select * into v_card from public.cards where id = p_card_id;
    if not found then raise exception 'Card not found.'; end if;
    if v_card.is_active is not true then raise exception 'Card is not active.'; end if;
    if v_card.unlock_method is distinct from 'points' or v_card.card_type = 'mascot' then
        raise exception 'Card cannot be purchased with points.';
    end if;
    if exists (select 1 from public.user_cards
        where user_id = p_user_id and card_id = p_card_id) then
        raise exception 'Card already owned.';
    end if;
    -- A removed/inconsistent inventory row must not allow a historical double debit.
    if exists (select 1 from public.reward_events
        where user_id = p_user_id and card_id = p_card_id
          and event_type = 'card_purchase') then
        raise exception 'Economic operation state is inconsistent.';
    end if;
    if v_balance < v_card.cost then raise exception 'Insufficient points balance.'; end if;

    insert into public.user_cards (user_id, card_id, source)
        values (p_user_id, p_card_id, 'points');
    v_balance := v_balance - v_card.cost;
    update public.profiles set points_balance = v_balance, updated_at = now()
        where id = p_user_id;
    insert into public.reward_events (
        user_id, event_type, points_delta, card_id,
        idempotency_key, idempotency_version, metadata
    ) values (
        p_user_id, 'card_purchase', -v_card.cost, p_card_id, v_key, 2,
        jsonb_build_object('card_name', v_card.name, 'card_slug', v_card.slug,
            'cost', v_card.cost, 'unlock_method', v_card.unlock_method)
    ) returning * into v_event;
    return jsonb_build_object(
        'reward_id', v_event.id, 'user_id', p_user_id,
        'card_id', p_card_id, 'card_name', v_card.name,
        'card_slug', v_card.slug, 'points_delta', v_event.points_delta,
        'points_balance', v_balance, 'already_processed', false
    );
end;
$$;

create or replace function public.complete_activity_attempt(
    p_user_id uuid, p_attempt_id uuid, p_event_type text,
    p_idempotency_key text, p_score integer default null,
    p_points_delta integer default 0, p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare
    v_request text := btrim(p_idempotency_key);
    v_type text := btrim(p_event_type);
    v_key text;
    v_balance integer;
    v_attempt public.activity_attempts%rowtype;
    v_event public.reward_events%rowtype;
begin
    if p_user_id is null or p_attempt_id is null then
        raise exception 'User and activity attempt are required.';
    end if;
    if v_type is null or length(v_type) not between 1 and 64
       or v_type = 'card_purchase' then
        raise exception 'Activity event type is invalid.';
    end if;
    if v_request is null or length(v_request) not between 1 and 128 then
        raise exception 'Idempotency key must contain between 1 and 128 characters.';
    end if;
    if p_points_delta is null or p_points_delta < 0 or p_score < 0 then
        raise exception 'Activity rewards and score must be nonnegative.';
    end if;

    select points_balance into v_balance from public.profiles
        where id = p_user_id for update;
    if not found then raise exception 'Profile not found.'; end if;
    select * into v_attempt from public.activity_attempts
        where id = p_attempt_id and user_id = p_user_id for update;
    if not found then raise exception 'Activity attempt not found.'; end if;
    if v_type = 'daily_trivia_completion' and (
        v_attempt.activity_type is distinct from 'trivia'
        or v_attempt.daily_trivia_id is null
    ) then
        raise exception 'Activity event type is invalid.';
    end if;

    v_key := public.reward_operation_key(p_user_id,
        'activity:' || v_attempt.activity_type || ':' || v_type, v_request);
    perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
    select * into v_event from public.reward_events
        where idempotency_version = 2 and idempotency_key = v_key;
    if not found then
        select e.* into v_event from public.reward_events e
            where e.idempotency_version = 1 and e.idempotency_key = v_request
              and e.user_id = p_user_id and e.event_type = v_type
              and (e.attempt_id is null or exists (
                  select 1 from public.activity_attempts legacy_attempt
                  where legacy_attempt.id = e.attempt_id
                    and legacy_attempt.activity_type = v_attempt.activity_type
              ));
    end if;

    if v_event.id is not null then
        if v_event.user_id is distinct from p_user_id
           or v_event.event_type is distinct from v_type
           or v_event.attempt_id is distinct from p_attempt_id
           or v_event.card_id is not null
           or v_event.points_delta is distinct from p_points_delta then
            raise exception 'Idempotency key belongs to another operation.';
        end if;
        if v_attempt.status is distinct from 'completed'
           or v_attempt.score is distinct from p_score then
            raise exception 'Economic operation state is inconsistent.';
        end if;
        return jsonb_build_object(
            'reward_id', v_event.id, 'attempt_id', p_attempt_id,
            'user_id', p_user_id, 'points_delta', v_event.points_delta,
            'points_balance', v_balance, 'already_processed', true
        );
    end if;

    if v_attempt.status is distinct from 'started' then
        raise exception 'Activity attempt cannot be completed.';
    end if;
    if exists (select 1 from public.reward_events
        where user_id = p_user_id and attempt_id = p_attempt_id) then
        raise exception 'Economic operation state is inconsistent.';
    end if;
    v_balance := v_balance + p_points_delta;
    update public.activity_attempts
        set status = 'completed', score = p_score, completed_at = now()
        where id = p_attempt_id and user_id = p_user_id;
    insert into public.reward_events (
        user_id, attempt_id, event_type, points_delta,
        idempotency_key, idempotency_version, metadata
    ) values (
        p_user_id, p_attempt_id, v_type, p_points_delta, v_key, 2,
        coalesce(p_metadata, '{}'::jsonb) ||
            jsonb_build_object('activity_type', v_attempt.activity_type)
    ) returning * into v_event;
    update public.profiles set points_balance = v_balance, updated_at = now()
        where id = p_user_id;
    return jsonb_build_object(
        'reward_id', v_event.id, 'attempt_id', p_attempt_id,
        'user_id', p_user_id, 'points_delta', v_event.points_delta,
        'points_balance', v_balance, 'already_processed', false
    );
end;
$$;

-- Keep exactly the existing public RPC signatures and least-privilege model.
revoke all on function public.reward_operation_key(uuid, text, text)
    from public, anon, authenticated;
grant execute on function public.reward_operation_key(uuid, text, text) to service_role;
revoke all on function public.purchase_card(uuid, bigint, text)
    from public, anon, authenticated;
grant execute on function public.purchase_card(uuid, bigint, text) to service_role;
revoke all on function public.complete_activity_attempt(uuid, uuid, text, text, integer, integer, jsonb)
    from public, anon, authenticated;
grant execute on function public.complete_activity_attempt(uuid, uuid, text, text, integer, integer, jsonb)
    to service_role;

-- Preserve daily scoring (5 questions, 20 points per correct answer) and
-- its legacy request hint; the generic function owns the v2 namespace.
create or replace function public.complete_daily_trivia_attempt(
    p_user_id uuid,
    p_attempt_id uuid,
    p_daily_trivia_id uuid,
    p_trivia_date date
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_attempt_status text;
    v_attempt_score integer;
    v_daily_date date;
    v_question_count integer;
    v_points_per_correct integer;
    v_answer_count integer;
    v_score integer;
    v_points integer;
    v_result jsonb;
    v_idempotency_key text;
begin
    if p_user_id is null or p_attempt_id is null
       or p_daily_trivia_id is null or p_trivia_date is null then
        raise exception 'Daily trivia identity is required.';
    end if;
    -- Same lock order as purchase/generic completion. The old attempt-first
    -- order could deadlock against a simultaneous generic completion.
    perform 1 from public.profiles where id = p_user_id for update;
    if not found then raise exception 'Profile not found.'; end if;

    select status, score
    into v_attempt_status, v_attempt_score
    from public.activity_attempts
    where id = p_attempt_id
      and user_id = p_user_id
      and activity_type = 'trivia'
      and daily_trivia_id = p_daily_trivia_id
    for update;

    if not found then
        raise exception 'Daily trivia attempt not found.';
    end if;

    select trivia_date, question_count, points_per_correct
    into v_daily_date, v_question_count, v_points_per_correct
    from public.daily_trivias
    where id = p_daily_trivia_id;

    if not found or v_daily_date is distinct from p_trivia_date then
        raise exception 'Daily trivia attempt has expired.';
    end if;

    v_idempotency_key :=
        'daily-trivia:' || p_daily_trivia_id::text || ':' || p_user_id::text;

    if v_attempt_status = 'completed' then
        v_score := v_attempt_score;
    elsif v_attempt_status = 'started' then
        select count(*)
        into v_answer_count
        from public.trivia_attempt_answers as answer
        join public.daily_trivia_questions as daily_question
          on daily_question.daily_trivia_id = p_daily_trivia_id
         and daily_question.question_id = answer.question_id
        where answer.attempt_id = p_attempt_id;

        if v_answer_count <> v_question_count then
            raise exception
                'All daily trivia questions must be answered. Expected %, found %.',
                v_question_count,
                v_answer_count;
        end if;

        select count(*)
        into v_score
        from public.trivia_attempt_answers as answer
        join public.daily_trivia_questions as daily_question
          on daily_question.daily_trivia_id = p_daily_trivia_id
         and daily_question.question_id = answer.question_id
        join public.trivia_options as selected_option
          on selected_option.id = answer.selected_option_id
         and selected_option.question_id = answer.question_id
        where answer.attempt_id = p_attempt_id
          and selected_option.is_correct = true;
    else
        raise exception 'Daily trivia attempt cannot be completed.';
    end if;

    v_points := v_score * v_points_per_correct;

    v_result := public.complete_activity_attempt(
        p_user_id,
        p_attempt_id,
        'daily_trivia_completion',
        v_idempotency_key,
        v_score,
        v_points,
        jsonb_build_object(
            'daily_trivia_id', p_daily_trivia_id,
            'trivia_date', v_daily_date,
            'question_count', v_question_count
        )
    );

    return v_result || jsonb_build_object(
        'status', 'completed',
        'score', v_score,
        'question_count', v_question_count,
        'points_earned', (v_result ->> 'points_delta')::integer,
        'trivia_date', v_daily_date
    );
end;
$$;

revoke all on function public.complete_daily_trivia_attempt(uuid, uuid, uuid, date)
    from public, anon, authenticated;
grant execute on function public.complete_daily_trivia_attempt(uuid, uuid, uuid, date)
    to service_role;
