-- ============================================================
-- ZONA DIAMANTE
-- Collection cards schema
-- ============================================================

-- Define how each card can be unlocked.
--
-- points = purchased with the user's points balance
-- ar     = unlocked through an AR activity

alter table public.cards
add column if not exists unlock_method text
    not null
    default 'points';


-- Only supported unlock methods are allowed.

alter table public.cards
drop constraint if exists cards_unlock_method_check;

alter table public.cards
add constraint cards_unlock_method_check
check (
    unlock_method in (
        'points',
        'ar'
    )
);


-- AR cards must never have a points cost.

alter table public.cards
drop constraint if exists cards_ar_cost_zero_check;

alter table public.cards
add constraint cards_ar_cost_zero_check
check (
    unlock_method <> 'ar'
    or cost = 0
);