-- Corrige referencias ambiguas entre la columna daily_trivia_id y el
-- parametro de salida homonimo de la funcion.

create or replace function public.get_or_create_daily_trivia(
    p_trivia_date date
)
returns table (
    daily_trivia_id uuid,
    daily_date date,
    question_count smallint,
    points_per_correct integer,
    created_at timestamptz
)
language plpgsql
set search_path = public
as $$
declare
    v_trivia public.daily_trivias%rowtype;
    v_selected_count integer;
begin
    if p_trivia_date is null then
        raise exception 'p_trivia_date is required';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'daily_trivia:' || p_trivia_date::text,
            0
        )
    );

    select trivia.*
    into v_trivia
    from public.daily_trivias as trivia
    where trivia.trivia_date = p_trivia_date;

    if v_trivia.id is null then
        insert into public.daily_trivias (
            trivia_date,
            question_count,
            points_per_correct
        )
        values (
            p_trivia_date,
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
                    and recent_trivia.trivia_date < p_trivia_date
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
        trivia.created_at
    from public.daily_trivias as trivia
    where trivia.id = v_trivia.id;
end;
$$;

revoke all on function public.get_or_create_daily_trivia(date)
from public, anon, authenticated;

grant execute on function public.get_or_create_daily_trivia(date)
to service_role;
