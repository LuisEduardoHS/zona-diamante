-- Private support inbox and durable email outbox. No outbound mail or cron here.
create table public.help_feedback (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    request_id uuid not null,
    reason text not null check(reason in ('problem','suggestion','question')),
    contact text not null default '' check(char_length(contact)<=200),
    message text not null check(char_length(btrim(message)) between 10 and 4000),
    sender_email text not null,
    sender_name text not null,
    recipient_email text not null,
    status text not null default 'pending' check(status in ('pending','sending','retry','sent','failed','uncertain')),
    attempts integer not null default 0,
    first_attempt_at timestamptz,
    ambiguous boolean not null default false,
    next_attempt_at timestamptz not null default now(),
    lease_token uuid,
    lease_until timestamptz,
    provider_message_id text,
    last_error text,
    created_at timestamptz not null default now(),
    sent_at timestamptz,
    unique(user_id,request_id)
);
create index help_feedback_user_date on public.help_feedback(user_id,created_at);
create index help_feedback_pending on public.help_feedback(next_attempt_at)
    where status in ('pending','sending','retry');
alter table public.help_feedback enable row level security;
revoke all on public.help_feedback from public,anon,authenticated;
grant select,insert,update,delete on public.help_feedback to service_role;

create function public.submit_help_feedback(p_user_id uuid,p_request_id uuid,p_reason text,
    p_contact text,p_message text,p_recipient text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare d public.help_feedback%rowtype; sender text; display text;
begin
    -- Serialize rate-limit and duplicate checks for each account.
    perform 1 from public.profiles where id=p_user_id for update;
    if not found then raise exception 'Profile not found.'; end if;
    select * into d from public.help_feedback where user_id=p_user_id and request_id=p_request_id;
    if found then
        if d.reason is distinct from p_reason or d.contact is distinct from p_contact
            or d.message is distinct from p_message then raise exception 'Feedback request conflict.'; end if;
        return jsonb_build_object('id',d.id,'status','received');
    end if;
    select u.email,coalesce(nullif(btrim(p.display_name),''),p.username) into sender,display
    from public.profiles p join auth.users u on u.id=p.id
    where p.id=p_user_id and u.email_confirmed_at is not null and u.deleted_at is null
        and (u.banned_until is null or u.banned_until<=clock_timestamp());
    if sender is null then raise exception 'Verified account required.'; end if;
    if (select count(*) from public.help_feedback where user_id=p_user_id
        and created_at>clock_timestamp()-interval '1 hour')>=3
        or (select count(*) from public.help_feedback where user_id=p_user_id
        and created_at>clock_timestamp()-interval '24 hours')>=10 then
        raise exception 'Feedback rate limit exceeded.';
    end if;
    insert into public.help_feedback(user_id,request_id,reason,contact,message,sender_email,sender_name,recipient_email)
    values(p_user_id,p_request_id,p_reason,p_contact,p_message,sender,display,p_recipient) returning * into d;
    return jsonb_build_object('id',d.id,'status','received');
end $$;

create function public.claim_help_feedback(p_id uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare d public.help_feedback%rowtype;
begin
    -- Shorter than the provider's idempotency window: don't blindly resend
    -- an ambiguous send after a long outage. Keep the original message stored.
    update public.help_feedback set status='uncertain',last_error='confirmation_window_elapsed'
    where status in ('sending','retry') and first_attempt_at<clock_timestamp()-interval '10 minutes'
        and (lease_until is null or lease_until<clock_timestamp());
    select * into d from public.help_feedback
    where (p_id is null or id=p_id) and status in ('pending','sending','retry')
        and next_attempt_at<=clock_timestamp() and (lease_until is null or lease_until<clock_timestamp())
    order by created_at,id limit 1 for update skip locked;
    if not found then return null; end if;
    update public.help_feedback set status='sending',attempts=attempts+1,
        ambiguous=ambiguous or status='sending',first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),
        lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '1 minute'
    where id=d.id returning * into d;
    return to_jsonb(d);
end $$;

create function public.finish_help_feedback(p_id uuid,p_lease uuid,p_status text,
    p_message_id text default null,p_error text default null,p_definitely_unsent boolean default false)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
    if p_status not in ('sent','retry','failed') then raise exception 'Invalid delivery status.'; end if;
    update public.help_feedback set status=p_status,provider_message_id=p_message_id,last_error=p_error,
        lease_until=null,lease_token=null,next_attempt_at=clock_timestamp()+interval '5 minutes',
        first_attempt_at=case when p_definitely_unsent and not ambiguous then null else first_attempt_at end,
        ambiguous=ambiguous or (p_status='retry' and not p_definitely_unsent),
        sent_at=case when p_status='sent' then clock_timestamp() else null end
    where id=p_id and lease_token=p_lease and status='sending';
    return found;
end $$;

revoke all on function public.submit_help_feedback(uuid,uuid,text,text,text,text),
    public.claim_help_feedback(uuid),public.finish_help_feedback(uuid,uuid,text,text,text,boolean)
    from public,anon,authenticated;
grant execute on function public.submit_help_feedback(uuid,uuid,text,text,text,text),
    public.claim_help_feedback(uuid),public.finish_help_feedback(uuid,uuid,text,text,text,boolean)
    to service_role;
