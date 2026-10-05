-- Permisos exclusivos para operaciones del backend.
-- service_role bypassa RLS, pero sigue necesitando privilegios SQL.

grant select
on table public.profiles
to service_role;

grant select, insert, update
on table public.activity_attempts
to service_role;

grant select, insert
on table public.reward_events
to service_role;

grant select
on table public.cards
to service_role;

grant select, insert
on table public.user_cards
to service_role;