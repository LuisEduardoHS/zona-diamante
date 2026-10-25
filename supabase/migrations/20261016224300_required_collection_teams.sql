-- H01: intentional historical gap-fill, BEFORE the collection catalog migration.
-- Do not rename/rewrite the 18 historical migrations from 611822e. Existing slugs,
-- IDs and editorial content are preserved; fresh installs get reference rows.
-- Existing deployments must review migration history and apply this missing
-- version explicitly with --include-all (see docs/fase-01-estabilizacion-supabase.md).
insert into public.teams (slug, name)
values
    ('sultanes-mty', 'Sultanes'),
    ('dorados-chi', 'Dorados'),
    ('charros-jal', 'Charros'),
    ('algodoneros-ul', 'Algodoneros')
on conflict (slug) do nothing;
