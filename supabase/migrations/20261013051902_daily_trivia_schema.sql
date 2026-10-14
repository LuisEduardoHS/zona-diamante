-- ============================================================
-- DAILY TRIVIA
-- Banco de preguntas, trivias diarias y respuestas de usuarios
-- ============================================================


-- ============================================================
-- 1. BANCO DE PREGUNTAS
-- ============================================================

create table public.trivia_questions (
    id uuid primary key default gen_random_uuid(),

    question_text text not null
        check (length(btrim(question_text)) > 0),

    category text,
    difficulty text,

    is_active boolean not null default true,

    created_at timestamptz not null default now()
);


-- ============================================================
-- 2. OPCIONES DE CADA PREGUNTA
-- ============================================================

create table public.trivia_options (
    id uuid primary key default gen_random_uuid(),

    question_id uuid not null
        references public.trivia_questions(id)
        on delete cascade,

    option_text text not null
        check (length(btrim(option_text)) > 0),

    position smallint not null
        check (position between 1 and 4),

    is_correct boolean not null default false,

    created_at timestamptz not null default now(),

    constraint trivia_options_question_position_unique
        unique (question_id, position),

    constraint trivia_options_id_question_unique
        unique (id, question_id)
);


-- Una pregunta no puede tener más de una respuesta correcta.
-- El backend también verificará que una pregunta válida tenga
-- exactamente 4 opciones y exactamente 1 respuesta correcta.

create unique index trivia_options_one_correct_per_question_idx
on public.trivia_options (question_id)
where is_correct = true;


create index trivia_options_question_id_idx
on public.trivia_options (question_id);


-- ============================================================
-- 3. TRIVIA CORRESPONDIENTE A CADA DÍA
-- ============================================================

create table public.daily_trivias (
    id uuid primary key default gen_random_uuid(),

    trivia_date date not null unique,

    question_count smallint not null default 5
        check (question_count between 1 and 20),

    points_per_correct integer not null default 20
        check (points_per_correct >= 0),

    created_at timestamptz not null default now()
);


-- Guardamos question_count y points_per_correct en la trivia
-- diaria para conservar históricamente las reglas utilizadas.
--
-- V1:
-- question_count = 5
-- points_per_correct = 20


-- ============================================================
-- 4. PREGUNTAS ASIGNADAS A UNA TRIVIA DIARIA
-- ============================================================

create table public.daily_trivia_questions (
    daily_trivia_id uuid not null
        references public.daily_trivias(id)
        on delete cascade,

    question_id uuid not null
        references public.trivia_questions(id),

    position smallint not null
        check (position between 1 and 20),

    primary key (daily_trivia_id, question_id),

    constraint daily_trivia_question_position_unique
        unique (daily_trivia_id, position)
);


create index daily_trivia_questions_question_id_idx
on public.daily_trivia_questions (question_id);


-- ============================================================
-- 5. RELACIONAR ACTIVITY_ATTEMPTS CON LA TRIVIA DEL DÍA
-- ============================================================

alter table public.activity_attempts
add column daily_trivia_id uuid
    references public.daily_trivias(id)
    on delete restrict;


create index activity_attempts_daily_trivia_id_idx
on public.activity_attempts (daily_trivia_id);


-- Un usuario sólo puede tener un intento para una trivia diaria.
--
-- Esto también protege contra múltiples peticiones de inicio.

create unique index activity_attempts_one_daily_trivia_per_user_idx
on public.activity_attempts (user_id, daily_trivia_id)
where activity_type = 'trivia'
  and daily_trivia_id is not null;


-- ============================================================
-- 6. RESPUESTAS DEL USUARIO
-- ============================================================

create table public.trivia_attempt_answers (
    attempt_id uuid not null
        references public.activity_attempts(id)
        on delete cascade,

    question_id uuid not null,

    selected_option_id uuid not null,

    answered_at timestamptz not null default now(),

    primary key (attempt_id, question_id),

    constraint trivia_attempt_answer_option_matches_question
        foreign key (selected_option_id, question_id)
        references public.trivia_options(id, question_id)
);


create index trivia_attempt_answers_selected_option_idx
on public.trivia_attempt_answers (selected_option_id);


-- ============================================================
-- 7. SEGURIDAD
-- ============================================================

alter table public.trivia_questions
enable row level security;

alter table public.trivia_options
enable row level security;

alter table public.daily_trivias
enable row level security;

alter table public.daily_trivia_questions
enable row level security;

alter table public.trivia_attempt_answers
enable row level security;


-- El navegador NO accede directamente a estas tablas.
--
-- Esto es especialmente importante para trivia_options porque
-- contiene is_correct.

revoke all
on table public.trivia_questions
from public, anon, authenticated;

revoke all
on table public.trivia_options
from public, anon, authenticated;

revoke all
on table public.daily_trivias
from public, anon, authenticated;

revoke all
on table public.daily_trivia_questions
from public, anon, authenticated;

revoke all
on table public.trivia_attempt_answers
from public, anon, authenticated;


-- ============================================================
-- 8. PERMISOS DEL BACKEND
-- ============================================================

grant select
on table public.trivia_questions
to service_role;

grant select
on table public.trivia_options
to service_role;

grant select, insert
on table public.daily_trivias
to service_role;

grant select, insert
on table public.daily_trivia_questions
to service_role;

grant select, insert, update
on table public.trivia_attempt_answers
to service_role;