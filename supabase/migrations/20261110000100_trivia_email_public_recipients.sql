-- Stop reserved test addresses from generating real provider bounces.
-- Historical accepted messages and real account preferences are preserved.
create function public.trivia_email_public_domain(p_email text)
returns boolean language sql immutable set search_path=pg_catalog as $$
    select coalesce(
        btrim(p_email) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        and lower(rtrim(split_part(btrim(p_email),'@',2),'.')) !~ '(^|\.)(invalid|test|example|localhost)$'
        and lower(rtrim(split_part(btrim(p_email),'@',2),'.')) !~ '(^|\.)example\.(com|net|org)$', false);
$$;
revoke all on function public.trivia_email_public_domain(text) from public,anon,authenticated;
grant execute on function public.trivia_email_public_domain(text) to service_role;

create or replace function public.prepare_trivia_emails(p_trivia_id uuid,p_timezone text)
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
        and public.trivia_email_public_domain(u.email) and u.deleted_at is null
        and (u.banned_until is null or u.banned_until<=clock_timestamp())
        and p.created_at<=starts
        and not exists(select 1 from public.activity_attempts a
            where a.user_id=p.id and a.daily_trivia_id=t.id and a.status='completed')
    on conflict(user_id,trivia_id) do nothing;
    get diagnostics total=row_count;
    return total;
end $$;

create or replace function public.claim_trivia_email(p_trivia_id uuid) returns jsonb
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
            and public.trivia_email_public_domain(u.email)
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

