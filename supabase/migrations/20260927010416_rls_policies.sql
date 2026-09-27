-- ZONA DIAMANTE
-- Row Level Security policies

-- 1. TEAMS
-- Visitantes y usuarios solo pueden leer los equipos activos

revoke all on table public.teams from anon, authenticated;

grant select
on table public.teams
to anon, authenticated;

create policy "teams_read_active"
on public.teams
for select
to anon, authenticated
using (is_active = true);


-- 2. CARDS
-- Visitantes y usuarios solo pueden leer las tarjetas activas

revoke all on table public.cards from anon, authenticated;

grant select
on table public.cards
to anon, authenticated;

create policy "cards_read_active"
on public.cards
for select
to anon, authenticated
using (is_active = true);


-- 3. PROFILES
-- Los usuarios solo pueden leer su propio perfil

revoke all on table public.profiles from anon, authenticated;

grant select
on table public.profiles
to authenticated;

create policy "profiles_read_own"
on public.profiles
for select
to authenticated
using (
    auth.uid() = id
);


-- El usuario solo puede actualizar campos editables

grant update (
    username,
    display_name,
    avatar_path
)
on table public.profiles
to authenticated;

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (
    auth.uid() = id
)
with check (
    auth.uid() = id
);


-- 4. USER_CARDS
-- Los usuarios solo pueden leer sus propias tarjetas

revoke all on table public.user_cards from anon, authenticated;

grant select
on table public.user_cards
to authenticated;

create policy "user_cards_read_own"
on public.user_cards
for select
to authenticated
using (
    auth.uid() = user_id
);


-- 5. ACTIVITY_ATTEMPTS
-- Los usuarios solo pueden leer sus propios intentos de actividad

revoke all
on table public.activity_attempts
from anon, authenticated;


-- 6. REWARD_EVENTS
-- Las recompensas solo pueden ser administradas por el sistema, no por los usuarios

revoke all
on table public.reward_events
from anon, authenticated;