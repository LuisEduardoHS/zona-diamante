-- Run exclusively inside the acceptance wrapper's BEGIN/ROLLBACK; no emails.
create temporary table email_fixture as select gen_random_uuid() uid,gen_random_uuid() disabled,
    gen_random_uuid() recent,gen_random_uuid() unconfirmed,gen_random_uuid() reserved;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select id,'mail-qa-'||id||case when id=reserved then '@example.invalid' else '@qa.zona-diamante.dev' end,case when id<>unconfirmed then now() else null end,
    jsonb_build_object('username','mail_'||replace(id::text,'-',''))
from email_fixture cross join lateral(values(uid),(disabled),(recent),(unconfirmed),(reserved)) ids(id);
update public.profiles set created_at=now()-interval '2 days'
where id in (select uid from email_fixture union select disabled from email_fixture union select unconfirmed from email_fixture union select reserved from email_fixture);
grant select on email_fixture to service_role;
set local role service_role;
do $$
declare
    f record; t uuid; day date; slot smallint; job jsonb; again jsonb; token uuid;
    tries integer:=0; prepared integer;
begin
    select * into f from email_fixture;
    if has_function_privilege('anon','public.prepare_trivia_emails(uuid,text)','EXECUTE')
        or has_function_privilege('authenticated','public.trivia_email_preference(uuid,boolean)','EXECUTE')
        or has_table_privilege('authenticated','public.trivia_email_deliveries','SELECT') then
        raise exception 'Email PII or delivery RPC exposed to browser roles.';
    end if;
    if public.trivia_email_preference(f.uid) is not true then raise exception 'Default preference mismatch.'; end if;
    perform public.trivia_email_preference(f.disabled,false);
    day:=(clock_timestamp() at time zone 'America/Monterrey')::date;
    slot:=case when extract(hour from clock_timestamp() at time zone 'America/Monterrey')>=12 then 1 else 0 end;
    select daily_trivia_id into t from public.get_or_create_daily_trivia(day,slot);
    prepared:=public.prepare_trivia_emails(t,'America/Monterrey');
    if (select count(*) from public.trivia_email_deliveries where user_id=f.uid and trivia_id=t)<>1 then raise exception 'Eligible account was not queued.'; end if;
    if exists(select 1 from public.trivia_email_deliveries where user_id in (f.disabled,f.recent,f.unconfirmed,f.reserved)) then raise exception 'Ineligible/reserved account was queued.'; end if;
    if public.prepare_trivia_emails(t,'America/Monterrey')<>0 then raise exception 'Repeated schedule queued duplicates.'; end if;
    update public.trivia_email_deliveries set created_at=now()-interval '1 day' where user_id=f.uid;
    loop
        job:=public.claim_trivia_email(t); tries:=tries+1;
        if job is null or tries>1000 then raise exception 'Fixture not claimable.'; end if;
        exit when (job->>'user_id')::uuid=f.uid;
    end loop;
    if job->>'status'<>'sending' then raise exception 'Missing delivery lease.'; end if;
    if public.finish_trivia_email((job->>'id')::uuid,gen_random_uuid(),'sent') then raise exception 'Stale worker could finalize delivery.'; end if;
    perform public.finish_trivia_email((job->>'id')::uuid,(job->>'lease_token')::uuid,'retry',p_error=>'provider_unreachable');
    update public.trivia_email_deliveries set next_attempt_at=clock_timestamp()-interval '1 second' where user_id=f.uid;
    again:=public.claim_trivia_email(t);
    if again->>'id' is distinct from job->>'id' or again->>'lease_token'=job->>'lease_token' then raise exception 'Retry identity or lease mismatch.'; end if;
    perform public.finish_trivia_email((again->>'id')::uuid,(again->>'lease_token')::uuid,'retry',p_error=>'provider_429',p_definitely_unsent=>true);
    if (select first_attempt_at is null from public.trivia_email_deliveries where user_id=f.uid) then raise exception 'Rate limit erased an ambiguous send.'; end if;
    update public.trivia_email_deliveries set first_attempt_at=clock_timestamp()-interval '11 minutes',next_attempt_at=clock_timestamp()-interval '1 second' where user_id=f.uid;
    perform public.claim_trivia_email(t);
    if (select status from public.trivia_email_deliveries where user_id=f.uid)<>'uncertain' then raise exception 'Ambiguous email would be resent outside idempotency window.'; end if;
    select unsubscribe_token into token from public.email_preferences where user_id=f.uid;
    perform public.unsubscribe_trivia_email(token);
    if public.trivia_email_preference(f.uid) is not false then raise exception 'Unsubscribe did not persist.'; end if;
    -- An opted-out pending delivery is suppressed on its next claim.
    update public.trivia_email_deliveries set status='pending',first_attempt_at=null where user_id=f.uid;
    perform public.claim_trivia_email(t);
    if (select status from public.trivia_email_deliveries where user_id=f.uid)<>'suppressed' then raise exception 'Unsubscribed delivery remained sendable.'; end if;
    insert into public.trivia_email_deliveries(user_id,trivia_id,recipient_email,recipient_name,question_count,points_per_correct,unsubscribe_token,expires_at)
    values(f.reserved,t,'legacy@example.invalid','Legacy fixture',5,20,gen_random_uuid(),clock_timestamp()+interval '30 minutes');
    perform public.claim_trivia_email(t);
    if (select status from public.trivia_email_deliveries where user_id=f.reserved)<>'suppressed' then raise exception 'Reserved legacy delivery remained sendable.'; end if;
    if public.trivia_email_public_domain('qa@SUB.EXAMPLE.COM')
        or public.trivia_email_public_domain('qa@demo.invalid.')
        or public.trivia_email_public_domain('qa@localhost')
        or not public.trivia_email_public_domain('qa+alias@gmail.com') then
        raise exception 'Public recipient filter mismatch.';
    end if;
end $$;
select 'PASS: eligibility, service-only access, isolated preferences, unique campaign, leases, unsubscribe and bounded retry' as result;
