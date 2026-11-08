-- Transaction-only regression for the deployed service_role permissions.
-- Run explicitly: supabase db query --linked --file backend/checks/ar_claim_permissions.sql
-- Synthetic user, cards and privilege changes are all rolled back.
begin;

do $$ begin
    if not has_column_privilege('service_role','public.teams','is_active','UPDATE')
        or not has_column_privilege('service_role','public.cards','is_active','UPDATE') then
        raise exception 'Missing AR catalog row-lock permissions.';
    end if;
    if has_column_privilege('authenticated','public.teams','is_active','UPDATE')
        or has_column_privilege('anon','public.cards','is_active','UPDATE') then
        raise exception 'Catalog write privileges exposed to clients.';
    end if;
end $$;

-- Local defaults can include table-wide UPDATE and hide the hosted bug.
-- REVOKE at table level also clears column grants; restore only the narrow
-- permissions from the migration before exercising the real reward functions.
revoke update on public.teams, public.cards from service_role;
grant update (is_active) on public.teams to service_role;
grant update (is_active) on public.cards to service_role;

create temporary table ar_permissions_fixture(uid uuid);
insert into ar_permissions_fixture values(gen_random_uuid());
insert into auth.users(id,email,raw_user_meta_data)
select uid, 'ar-permissions-'||uid||'@example.invalid',
       jsonb_build_object('username','ar_probe_'||replace(uid::text,'-',''))
from ar_permissions_fixture;
update public.profiles set points_balance=123 where id=(select uid from ar_permissions_fixture);
grant select on ar_permissions_fixture to service_role;

set local role service_role;
do $$
declare
    v_uid uuid := (select uid from ar_permissions_fixture);
    v_slug text;
    v_attempt uuid;
    v_reference text;
    v_first jsonb;
    v_retry jsonb;
begin
    foreach v_slug in array array['sultanes-mty','charros-jal','dorados-chi','algodoneros-ul'] loop
        v_reference := 'ar-self-service:v1:'||v_uid||':'||v_slug;
        v_attempt := public.authorize_ar_mascot(v_uid,v_slug,v_reference);
        v_first := public.grant_verified_ar_mascot(v_uid,v_attempt,v_reference);
        v_retry := public.grant_verified_ar_mascot(v_uid,v_attempt,v_reference);
        if (v_first->>'already_processed')::boolean is distinct from false
            or (v_first->>'already_owned')::boolean is distinct from false
            or (v_retry->>'already_processed')::boolean is distinct from true
            or v_first->>'card_id' is distinct from v_retry->>'card_id' then
            raise exception 'AR claim/retry failed for %.',v_slug;
        end if;
    end loop;
    if (select count(*) from public.user_cards where user_id=v_uid and source='ar') <> 4
        or (select count(*) from public.reward_events where user_id=v_uid and event_type='ar_mascot_unlock') <> 4
        or (select points_balance from public.profiles where id=v_uid) <> 123 then
        raise exception 'AR grants duplicated ownership, ledger events or changed the balance.';
    end if;
end $$;

select 'PASS: all four AR grants and retries with restricted catalog privileges; balance unchanged' as result;
rollback;
