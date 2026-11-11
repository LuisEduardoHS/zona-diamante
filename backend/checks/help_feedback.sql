-- Run against a migrated database with at least one confirmed profile.
-- All fixtures, including any temporarily hidden rows, roll back. No mail sends.
begin;
do $$
declare uid uuid; request uuid:=gen_random_uuid(); result jsonb; first_id uuid;
    claimed jsonb; blocked boolean:=false;
begin
    select p.id into uid from public.profiles p join auth.users u on u.id=p.id
    where u.email_confirmed_at is not null and u.deleted_at is null
        and (u.banned_until is null or u.banned_until<=clock_timestamp()) order by p.created_at limit 1;
    if uid is null then raise exception 'A confirmed test profile is required.'; end if;
    delete from public.help_feedback where user_id=uid;
    result:=public.submit_help_feedback(uid,request,'suggestion','','Prueba transaccional de Ayuda.','owner@example.com');
    first_id:=(result->>'id')::uuid;
    if result->>'status'<>'received' then raise exception 'Missing durable receipt'; end if;
    if public.submit_help_feedback(uid,request,'suggestion','','Prueba transaccional de Ayuda.','owner@example.com')<>result
        or (select count(*) from public.help_feedback where user_id=uid)<>1 then raise exception 'Duplicate submission'; end if;
    begin
        perform public.submit_help_feedback(uid,request,'question','','Un contenido distinto.','owner@example.com');
    exception when others then
        if sqlerrm<>'Feedback request conflict.' then raise; end if;
        blocked:=true;
    end;
    if not blocked then raise exception 'Conflicting retry accepted'; end if;
    perform public.submit_help_feedback(uid,gen_random_uuid(),'problem','','Otro mensaje de prueba.','owner@example.com');
    perform public.submit_help_feedback(uid,gen_random_uuid(),'question','','Una pregunta de prueba.','owner@example.com');
    blocked:=false;
    begin
        perform public.submit_help_feedback(uid,gen_random_uuid(),'question','','Cuarto mensaje de prueba.','owner@example.com');
    exception when others then
        if sqlerrm<>'Feedback rate limit exceeded.' then raise; end if;
        blocked:=true;
    end;
    if not blocked then raise exception 'Hourly limit bypassed'; end if;
    -- Move fixtures outside the hourly window while keeping them within a day.
    update public.help_feedback set created_at=now()-interval '2 hours' where user_id=uid;
    for n in 1..7 loop
        perform public.submit_help_feedback(uid,gen_random_uuid(),'question','','Prueba del límite diario.','owner@example.com');
        update public.help_feedback set created_at=now()-interval '2 hours' where user_id=uid;
    end loop;
    blocked:=false;
    begin
        perform public.submit_help_feedback(uid,gen_random_uuid(),'question','','Undécimo mensaje diario.','owner@example.com');
    exception when others then
        if sqlerrm<>'Feedback rate limit exceeded.' then raise; end if;
        blocked:=true;
    end;
    if not blocked then raise exception 'Daily limit bypassed'; end if;
    claimed:=public.claim_help_feedback(first_id);
    if claimed->>'status'<>'sending' or public.claim_help_feedback(first_id) is not null then raise exception 'Concurrent double claim'; end if;
    if public.finish_help_feedback(first_id,gen_random_uuid(),'sent') then raise exception 'Wrong lease accepted'; end if;
    blocked:=false;
    begin
        perform public.finish_help_feedback(first_id,(claimed->>'lease_token')::uuid,'retry',null,'timeout',false);
    exception when others then
        if sqlerrm<>'Ambiguous SMTP delivery cannot be retried.' then raise; end if;
        blocked:=true;
    end;
    if not blocked then raise exception 'Ambiguous SMTP retry accepted'; end if;
    if not public.finish_help_feedback(first_id,(claimed->>'lease_token')::uuid,'retry',null,'provider_429',true) then raise exception 'Retry failed'; end if;
    if exists(select 1 from public.help_feedback where id=first_id and first_attempt_at is not null) then raise exception 'Unsent retry window not reset'; end if;
    update public.help_feedback set next_attempt_at=now()-interval '1 second' where id=first_id;
    claimed:=public.claim_help_feedback(first_id);
    perform public.finish_help_feedback(first_id,(claimed->>'lease_token')::uuid,'sent','test-provider-reference');
    if public.claim_help_feedback(first_id) is not null then raise exception 'Accepted message resent'; end if;
    update public.help_feedback set status='sending',first_attempt_at=now()-interval '11 minutes',lease_until=now()-interval '1 minute' where id=first_id;
    if public.claim_help_feedback(first_id) is not null then raise exception 'Ambiguous message resent outside window'; end if;
    if (select status from public.help_feedback where id=first_id)<>'uncertain' then raise exception 'Missing uncertain state'; end if;
    if has_table_privilege('anon','public.help_feedback','SELECT') or has_table_privilege('authenticated','public.help_feedback','SELECT')
        or has_function_privilege('authenticated','public.submit_help_feedback(uuid,uuid,text,text,text,text)','EXECUTE')
        or has_function_privilege('anon','public.claim_help_feedback(uuid)','EXECUTE') then raise exception 'Private inbox exposed'; end if;
end $$;
rollback;
