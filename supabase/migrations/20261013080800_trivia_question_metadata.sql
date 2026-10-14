-- ============================================================
-- TRIVIA QUESTION METADATA
-- Explicaciones y dificultad controlada
-- ============================================================


-- ============================================================
-- 1. EXPLICACIÓN DE LA RESPUESTA
-- ============================================================

alter table public.trivia_questions
add column explanation text;


-- ============================================================
-- 2. DIFICULTAD CONTROLADA
-- ============================================================

alter table public.trivia_questions
add constraint trivia_questions_difficulty_check
check (
    difficulty is null
    or difficulty in (
        'easy',
        'medium',
        'hard'
    )
);