-- ============================================================
-- DAILY TRIVIA ATTEMPT RPCS
-- Inicio, guardado y finalizacion atomicos para FastAPI.
-- ============================================================


create or replace function public.get_or_create_daily_trivia_attempt(
    p_user_id uuid,
    p_daily_trivia_id uuid
)
returns table (
    attempt_id uuid,
    attempt_status text,
    attempt_score integer
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_attempt public.activity_attempts%rowtype;
begin
    if p_user_id is null or p_daily_trivia_id is null then
        raise exception 'User and daily trivia are required.';
    end if;

    if not exists (
        select 1
        from public.daily_trivias
        where id = p_daily_trivia_id
    ) then
        raise exception 'Daily trivia not found.';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'daily-trivia-attempt:' || p_user_id::text || ':' ||
            p_daily_trivia_id::text,
            0
        )
    );

    select *
    into v_attempt
    from public.activity_attempts
    where user_id = p_user_id
      and activity_type = 'trivia'
      and daily_trivia_id = p_daily_trivia_id
    limit 1;

    if v_attempt.id is null then
        insert into public.activity_attempts (
            user_id,
            activity_type,
            daily_trivia_id,
            metadata
        )
        values (
            p_user_id,
            'trivia',
            p_daily_trivia_id,
            jsonb_build_object('source', 'daily_trivia')
        )
        returning *
        into v_attempt;
    end if;

    return query
    select
        v_attempt.id,
        v_attempt.status,
        v_attempt.score;
end;
$$;


create or replace function public.save_daily_trivia_answer(
    p_user_id uuid,
    p_attempt_id uuid,
    p_daily_trivia_id uuid,
    p_question_id uuid,
    p_selected_option_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_attempt_status text;
begin
    select status
    into v_attempt_status
    from public.activity_attempts
    where id = p_attempt_id
      and user_id = p_user_id
      and activity_type = 'trivia'
      and daily_trivia_id = p_daily_trivia_id
    for update;

    if not found then
        raise exception 'Daily trivia attempt not found.';
    end if;

    if v_attempt_status <> 'started' then
        raise exception 'Daily trivia attempt is not in progress.';
    end if;

    if not exists (
        select 1
        from public.daily_trivia_questions
        where daily_trivia_id = p_daily_trivia_id
          and question_id = p_question_id
    ) then
        raise exception 'Question does not belong to the daily trivia.';
    end if;

    if not exists (
        select 1
        from public.trivia_options
        where id = p_selected_option_id
          and question_id = p_question_id
    ) then
        raise exception 'Option does not belong to the question.';
    end if;

    insert into public.trivia_attempt_answers (
        attempt_id,
        question_id,
        selected_option_id,
        answered_at
    )
    values (
        p_attempt_id,
        p_question_id,
        p_selected_option_id,
        now()
    )
    on conflict (attempt_id, question_id)
    do update set
        selected_option_id = excluded.selected_option_id,
        answered_at = excluded.answered_at;

    return jsonb_build_object(
        'question_id', p_question_id,
        'selected_option_id', p_selected_option_id,
        'saved', true
    );
end;
$$;


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

    if not found or v_daily_date <> p_trivia_date then
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


revoke all on function public.get_or_create_daily_trivia_attempt(uuid, uuid)
from public, anon, authenticated;

revoke all on function public.save_daily_trivia_answer(uuid, uuid, uuid, uuid, uuid)
from public, anon, authenticated;

revoke all on function public.complete_daily_trivia_attempt(uuid, uuid, uuid, date)
from public, anon, authenticated;

grant execute on function public.get_or_create_daily_trivia_attempt(uuid, uuid)
to service_role;

grant execute on function public.save_daily_trivia_answer(uuid, uuid, uuid, uuid, uuid)
to service_role;

grant execute on function public.complete_daily_trivia_attempt(uuid, uuid, uuid, date)
to service_role;
