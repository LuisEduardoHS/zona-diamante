begin;

create extension if not exists pgtap with schema extensions;

select plan(14);


-- TABLAS PRINCIPALES

select has_table(
    'public',
    'profiles',
    'profiles should exist'
);

select has_table(
    'public',
    'teams',
    'teams should exist'
);

select has_table(
    'public',
    'cards',
    'cards should exist'
);

select has_table(
    'public',
    'user_cards',
    'user_cards should exist'
);

select has_table(
    'public',
    'activity_attempts',
    'activity_attempts should exist'
);

select has_table(
    'public',
    'reward_events',
    'reward_events should exist'
);


-- COLUMNAS IMPORTANTES

select has_column(
    'public',
    'profiles',
    'points_balance',
    'profiles should contain points_balance'
);

select has_column(
    'public',
    'cards',
    'cost',
    'cards should contain cost'
);

select has_column(
    'public',
    'reward_events',
    'idempotency_key',
    'reward_events should contain idempotency_key'
);


-- RLS ACTIVADO

select ok(
    (
        select relrowsecurity
        from pg_class
        where oid = 'public.profiles'::regclass
    ),
    'RLS should be enabled on profiles'
);

select ok(
    (
        select relrowsecurity
        from pg_class
        where oid = 'public.teams'::regclass
    ),
    'RLS should be enabled on teams'
);

select ok(
    (
        select relrowsecurity
        from pg_class
        where oid = 'public.cards'::regclass
    ),
    'RLS should be enabled on cards'
);


-- PERMISOS GENERALES

select ok(
    has_table_privilege('anon', 'public.teams', 'SELECT'),
    'anon should be able to select teams'
);

select ok(
    not has_table_privilege('anon', 'public.profiles', 'SELECT'),
    'anon should not be able to select profiles'
);


select * from finish();

rollback;