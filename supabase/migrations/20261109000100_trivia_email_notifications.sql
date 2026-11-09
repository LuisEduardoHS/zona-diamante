-- Preparation only: no scheduler, provider credential or outbound email here.
create table public.email_preferences (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    trivia_email_enabled boolean not null default true,
    unsubscribe_token uuid not null unique default gen_random_uuid(),
    updated_at timestamptz not null default now()
);
create table public.trivia_email_deliveries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    trivia_id uuid not null references public.daily_trivias(id) on delete cascade,
    recipient_email text not null,
    recipient_name text not null,
    question_count smallint not null,
    points_per_correct integer not null,
    unsubscribe_token uuid not null,
    expires_at timestamptz not null,
    status text not null default 'pending'
        check(status in ('pending','sending','retry','sent','suppressed','failed','uncertain')),
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
    unique(user_id,trivia_id)
);
create index trivia_email_pending on public.trivia_email_deliveries(trivia_id,next_attempt_at)
    where status in ('pending','sending','retry');
alter table public.email_preferences enable row level security;
alter table public.trivia_email_deliveries enable row level security;
revoke all on public.email_preferences,public.trivia_email_deliveries from public,anon,authenticated;
grant select,insert,update,delete on public.email_preferences,public.trivia_email_deliveries to service_role;

create function public.trivia_email_preference(p_user_id uuid,p_enabled boolean default null)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare enabled boolean;
begin
    if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Profile not found.'; end if;
    insert into public.email_preferences(user_id) values(p_user_id) on conflict do nothing;
    if p_enabled is not null then
        update public.email_preferences set trivia_email_enabled=p_enabled,updated_at=clock_timestamp() where user_id=p_user_id;
    end if;
    select trivia_email_enabled into enabled from public.email_preferences where user_id=p_user_id;
    return enabled;
end $$;

create function public.unsubscribe_trivia_email(p_token uuid) returns void
language sql security definer set search_path=pg_catalog,public as $$
    update public.email_preferences set trivia_email_enabled=false,updated_at=clock_timestamp()
    where unsubscribe_token=p_token;
$$;

create function public.prepare_trivia_emails(p_trivia_id uuid,p_timezone text)
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.daily_trivias%rowtype; starts timestamptz; ends timestamptz; total integer;
begin
    select * into t from public.daily_trivias where id=p_trivia_id;
    if not found then raise exception 'Trivia not found.'; end if;
    starts:=(t.trivia_date::timestamp + make_interval(hours=>t.trivia_slot*12)) at time zone p_timezone;
    ends:=(t.trivia_date::timestamp + make_interval(hours=>(t.trivia_slot+1)*12)) at time zone p_timezone;
    if clock_timestamp()<starts or clock_timestamp()>=ends then raise exception 'Trivia is not current.'; end if;
    insert into public.email_preferences(user_id) select id from public.profiles on conflict do nothing;
    insert into public.trivia_email_deliveries(user_id,trivia_id,recipient_email,recipient_name,
        question_count,points_per_correct,unsubscribe_token,expires_at)
    select p.id,t.id,u.email,coalesce(nullif(btrim(p.display_name),''),p.username),
        t.question_count,t.points_per_correct,pref.unsubscribe_token,ends
    from public.profiles p join auth.users u on u.id=p.id
    join public.email_preferences pref on pref.user_id=p.id
    where pref.trivia_email_enabled and u.email_confirmed_at is not null
        and nullif(btrim(u.email),'') is not null and u.deleted_at is null
        and (u.banned_until is null or u.banned_until<=clock_timestamp())
        and p.created_at<=starts
        and not exists(select 1 from public.activity_attempts a
            where a.user_id=p.id and a.daily_trivia_id=t.id and a.status='completed')
    on conflict(user_id,trivia_id) do nothing;
    get diagnostics total=row_count;
    return total;
end $$;

create function public.claim_trivia_email(p_trivia_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare d public.trivia_email_deliveries%rowtype;
begin
    -- Recheck recipient eligibility before every attempt, including retries.
    update public.trivia_email_deliveries e set status='suppressed',last_error='no_longer_eligible'
    where e.status in ('pending','retry','sending') and (e.lease_until is null or e.lease_until<clock_timestamp())
    and (e.expires_at<=clock_timestamp() or not exists(
        select 1 from public.email_preferences pref join auth.users u on u.id=pref.user_id
        where pref.user_id=e.user_id and pref.trivia_email_enabled
            and u.email=e.recipient_email and u.email_confirmed_at is not null
            and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp())
    ) or exists(select 1 from public.activity_attempts a
        where a.user_id=e.user_id and a.daily_trivia_id=e.trivia_id and a.status='completed'));
    -- Brevo remembers idempotency keys for 30 minutes. Never blindly resend
    -- an ambiguous send outside our shorter, ten-minute recovery window.
    update public.trivia_email_deliveries set status='uncertain',last_error='confirmation_window_elapsed'
    where status in ('sending','retry') and first_attempt_at<clock_timestamp()-interval '10 minutes'
        and (lease_until is null or lease_until<clock_timestamp());
    select * into d from public.trivia_email_deliveries
    where trivia_id=p_trivia_id and status in ('pending','sending','retry')
        and expires_at>clock_timestamp() and next_attempt_at<=clock_timestamp()
        and (lease_until is null or lease_until<clock_timestamp())
    order by created_at,id limit 1 for update skip locked;
    if not found then return null; end if;
    update public.trivia_email_deliveries set status='sending',attempts=attempts+1,
        ambiguous=ambiguous or status='sending',
        first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),
        lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '1 minute'
    where id=d.id returning * into d;
    return to_jsonb(d);
end $$;

create function public.finish_trivia_email(p_id uuid,p_lease uuid,p_status text,
    p_message_id text default null,p_error text default null,p_definitely_unsent boolean default false)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
    if p_status not in ('sent','retry','failed') then raise exception 'Invalid delivery status.'; end if;
    update public.trivia_email_deliveries set status=p_status,provider_message_id=p_message_id,
        last_error=p_error,lease_until=null,lease_token=null,
        next_attempt_at=clock_timestamp()+interval '1 minute',
        first_attempt_at=case when p_definitely_unsent and not ambiguous then null else first_attempt_at end,
        ambiguous=ambiguous or (p_status='retry' and not p_definitely_unsent),
        sent_at=case when p_status='sent' then clock_timestamp() else null end
    where id=p_id and lease_token=p_lease and status='sending';
    return found;
end $$;

revoke all on function public.trivia_email_preference(uuid,boolean),public.unsubscribe_trivia_email(uuid),
    public.prepare_trivia_emails(uuid,text),public.claim_trivia_email(uuid),
    public.finish_trivia_email(uuid,uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.trivia_email_preference(uuid,boolean),public.unsubscribe_trivia_email(uuid),
    public.prepare_trivia_emails(uuid,text),public.claim_trivia_email(uuid),
    public.finish_trivia_email(uuid,uuid,text,text,text,boolean) to service_role;
