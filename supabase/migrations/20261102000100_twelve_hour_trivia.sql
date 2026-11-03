-- Two trivia periods per local day: 00:00-12:00 and 12:00-00:00.
-- Preserve all existing trivia/attempt/reward identities as the morning period.
alter table public.daily_trivias
    add column trivia_slot smallint not null default 0
    check (trivia_slot in (0, 1));
alter table public.daily_trivias drop constraint daily_trivias_trivia_date_key;
alter table public.daily_trivias
    add constraint daily_trivias_date_slot_key unique (trivia_date, trivia_slot);

create or replace function public.get_or_create_daily_trivia(
    p_trivia_date date,
    p_trivia_slot smallint
)
returns table (
    daily_trivia_id uuid,
    daily_date date,
    question_count smallint,
    points_per_correct integer,
    created_at timestamptz,
    trivia_slot smallint
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
    v_trivia public.daily_trivias%rowtype;
    v_selected_count integer;
begin
    if p_trivia_slot is null or p_trivia_slot not in (0, 1) then
        raise exception 'Invalid trivia period.';
    end if;

    if p_trivia_date is null then
        raise exception 'p_trivia_date is required';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'daily_trivia:' || p_trivia_date::text || ':' || p_trivia_slot::text,
            0
        )
    );

    select trivia.*
    into v_trivia
    from public.daily_trivias as trivia
    where trivia.trivia_date = p_trivia_date
      and trivia.trivia_slot = p_trivia_slot;

    if v_trivia.id is null then
        insert into public.daily_trivias (
            trivia_date,
            trivia_slot,
            question_count,
            points_per_correct
        )
        values (
            p_trivia_date,
            p_trivia_slot,
            5,
            20
        )
        returning *
        into v_trivia;

        insert into public.daily_trivia_questions (
            daily_trivia_id,
            question_id,
            position
        )
        select
            v_trivia.id,
            selected.id,
            row_number() over (
                order by selected.random_order
            )::smallint
        from (
            select
                question.id,
                random() as random_order
            from public.trivia_questions as question
            where question.is_active = true
              and question.explanation is not null
              and length(btrim(question.explanation)) > 0
              and (
                  select count(*)
                  from public.trivia_options as option
                  where option.question_id = question.id
              ) = 4
              and (
                  select count(*)
                  from public.trivia_options as option
                  where option.question_id = question.id
                    and option.is_correct = true
              ) = 1
              and not exists (
                  select 1
                  from public.daily_trivia_questions as recent_question
                  join public.daily_trivias as recent_trivia
                    on recent_trivia.id = recent_question.daily_trivia_id
                  where recent_question.question_id = question.id
                    and recent_trivia.trivia_date >= p_trivia_date - 5
                    and (recent_trivia.trivia_date, recent_trivia.trivia_slot)
                        < (p_trivia_date, p_trivia_slot)
              )
            order by random_order
            limit v_trivia.question_count
        ) as selected;

        select count(*)
        into v_selected_count
        from public.daily_trivia_questions as assigned_question
        where assigned_question.daily_trivia_id = v_trivia.id;

        if v_selected_count < v_trivia.question_count then
            insert into public.daily_trivia_questions (
                daily_trivia_id,
                question_id,
                position
            )
            select
                v_trivia.id,
                selected.id,
                (
                    v_selected_count
                    + row_number() over (
                        order by selected.random_order
                    )
                )::smallint
            from (
                select
                    question.id,
                    random() as random_order
                from public.trivia_questions as question
                where question.is_active = true
                  and question.explanation is not null
                  and length(btrim(question.explanation)) > 0
                  and (
                      select count(*)
                      from public.trivia_options as option
                      where option.question_id = question.id
                  ) = 4
                  and (
                      select count(*)
                      from public.trivia_options as option
                      where option.question_id = question.id
                        and option.is_correct = true
                  ) = 1
                  and not exists (
                      select 1
                      from public.daily_trivia_questions as assigned_question
                      where assigned_question.daily_trivia_id = v_trivia.id
                        and assigned_question.question_id = question.id
                  )
                order by random_order
                limit (
                    v_trivia.question_count
                    - v_selected_count
                )
            ) as selected;
        end if;

        select count(*)
        into v_selected_count
        from public.daily_trivia_questions as assigned_question
        where assigned_question.daily_trivia_id = v_trivia.id;

        if v_selected_count <> v_trivia.question_count then
            raise exception
                'Not enough valid trivia questions. Required %, found %.',
                v_trivia.question_count,
                v_selected_count;
        end if;
    end if;

    return query
    select
        trivia.id,
        trivia.trivia_date,
        trivia.question_count,
        trivia.points_per_correct,
        trivia.created_at,
        trivia.trivia_slot
    from public.daily_trivias as trivia
    where trivia.id = v_trivia.id;
end;
$$;

revoke all on function public.get_or_create_daily_trivia(date, smallint)
    from public, anon, authenticated;
grant execute on function public.get_or_create_daily_trivia(date, smallint)
    to service_role;

-- Compatibility for historical callers: one date still identifies slot 0.
create or replace function public.get_or_create_daily_trivia(p_trivia_date date)
returns table (
    daily_trivia_id uuid, daily_date date, question_count smallint,
    points_per_correct integer, created_at timestamptz
)
language sql security invoker set search_path = pg_catalog, public as $$
    select t.daily_trivia_id, t.daily_date, t.question_count,
           t.points_per_correct, t.created_at
    from public.get_or_create_daily_trivia(p_trivia_date, 0::smallint) as t;
$$;
revoke all on function public.get_or_create_daily_trivia(date)
    from public, anon, authenticated;
grant execute on function public.get_or_create_daily_trivia(date)
    to service_role;
