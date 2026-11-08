-- service_role can read the catalog, but PostgreSQL's SELECT ... FOR SHARE
-- also requires UPDATE on at least one column of each locked table.
-- AR grants lock both team and card rows while inserting the collectible.
-- Keep the existing locks and invoker functions; allow only this catalog
-- column on the server role, without granting any client write privileges.
grant update (is_active) on public.teams to service_role;
grant update (is_active) on public.cards to service_role;
