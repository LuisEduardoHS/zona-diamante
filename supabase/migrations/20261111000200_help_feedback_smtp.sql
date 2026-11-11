-- Gmail SMTP has no idempotency API: never blindly retry a lost DATA response.
create or replace function public.claim_help_feedback(p_id uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare d public.help_feedback%rowtype;
begin
    update public.help_feedback set status='uncertain',last_error='smtp_confirmation_unknown',lease_token=null,lease_until=null
    where status='sending' and lease_until<clock_timestamp();
    select * into d from public.help_feedback
    where (p_id is null or id=p_id) and status in ('pending','retry')
        and next_attempt_at<=clock_timestamp() and (lease_until is null or lease_until<clock_timestamp())
    order by created_at,id limit 1 for update skip locked;
    if not found then return null; end if;
    update public.help_feedback set status='sending',attempts=attempts+1,
        first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),
        lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes'
    where id=d.id returning * into d;
    return to_jsonb(d);
end $$;

create or replace function public.finish_help_feedback(p_id uuid,p_lease uuid,p_status text,
    p_message_id text default null,p_error text default null,p_definitely_unsent boolean default false)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
    if p_status not in ('sent','retry','failed','uncertain') then raise exception 'Invalid delivery status.'; end if;
    if p_status='retry' and not p_definitely_unsent then raise exception 'Ambiguous SMTP delivery cannot be retried.'; end if;
    update public.help_feedback set status=p_status,provider_message_id=p_message_id,last_error=p_error,
        lease_until=null,lease_token=null,next_attempt_at=clock_timestamp()+interval '5 minutes',
        first_attempt_at=case when p_definitely_unsent then null else first_attempt_at end,
        ambiguous=p_status='uncertain',sent_at=case when p_status='sent' then clock_timestamp() else null end
    where id=p_id and lease_token=p_lease and status='sending';
    return found;
end $$;
