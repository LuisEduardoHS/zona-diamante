-- Authorization is a trusted-server boundary, NOT evidence submitted by a
-- browser. No public HTTP writer or client RPC execution is enabled.
alter table public.activity_attempts
    add column ar_team_id bigint references public.teams(id),
    add column ar_verification_ref text,
    add column ar_verified_at timestamptz,
    add constraint ar_verified_attempt_shape check (
        (ar_team_id is null and ar_verification_ref is null and ar_verified_at is null)
        or (ar_team_id is not null and ar_verification_ref is not null and ar_verified_at is not null
            and activity_type = 'ar' and game_state is null and score is null
            and length(btrim(ar_verification_ref)) between 1 and 128)
    );
create unique index ar_verified_reference_unique on public.activity_attempts(ar_verification_ref)
    where ar_verification_ref is not null;
create unique index ar_verified_user_team_unique on public.activity_attempts(user_id, ar_team_id)
    where ar_team_id is not null;

alter table public.reward_events drop constraint reward_events_v2_shape_check;
alter table public.reward_events add constraint reward_events_v2_shape_check check (
    idempotency_version = 1 or (
        (event_type = 'card_purchase' and attempt_id is null and card_id is not null and points_delta <= 0)
        or (event_type = 'ar_mascot_unlock' and attempt_id is not null and card_id is not null and points_delta = 0)
        or (event_type not in ('card_purchase', 'ar_mascot_unlock') and attempt_id is not null
            and card_id is null and points_delta >= 0)
    )
);
create unique index ar_mascot_reward_unique on public.reward_events(user_id, card_id)
    where idempotency_version = 2 and event_type = 'ar_mascot_unlock';

-- Called only by a future trusted verifier/operator AFTER validating evidence.
-- A reference is an audit identifier, not a cryptographic proof by itself.
create function public.authorize_ar_mascot(
    p_user_id uuid, p_team_slug text, p_verification_ref text
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
    v_team bigint;
    v_attempt public.activity_attempts%rowtype;
begin
    if p_user_id is null or p_team_slug is null or p_verification_ref is null
       or length(btrim(p_verification_ref)) not between 1 and 128 then
        raise exception 'Invalid AR authorization.';
    end if;
    perform 1 from public.profiles where id = p_user_id for update;
    if not found then raise exception 'Profile not found.'; end if;
    select id into v_team from public.teams where slug = p_team_slug and is_active;
    if not found then raise exception 'AR team not available.'; end if;
    perform pg_advisory_xact_lock(hashtextextended('ar-verification:' || btrim(p_verification_ref), 0));
    select * into v_attempt from public.activity_attempts where ar_verification_ref = btrim(p_verification_ref);
    if found then
        if v_attempt.user_id is distinct from p_user_id or v_attempt.ar_team_id is distinct from v_team then
            raise exception 'AR verification belongs to another operation.';
        end if;
        return v_attempt.id;
    end if;
    if exists(select 1 from public.activity_attempts where user_id=p_user_id and ar_team_id=v_team) then
        raise exception 'AR authorization already exists.';
    end if;
    if (select count(*) from public.cards where team_id=v_team and is_active
        and card_type='mascot' and unlock_method='ar' and cost=0) <> 1 then
        raise exception 'AR mascot catalog is invalid.';
    end if;
    insert into public.activity_attempts(user_id,activity_type,ar_team_id,ar_verification_ref,ar_verified_at)
        values(p_user_id,'ar',v_team,btrim(p_verification_ref),now()) returning * into v_attempt;
    return v_attempt.id;
end;
$$;

create function public.grant_verified_ar_mascot(
    p_user_id uuid, p_attempt_id uuid, p_request_key text
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
    v_attempt public.activity_attempts%rowtype;
    v_card public.cards%rowtype;
    v_event public.reward_events%rowtype;
    v_key text;
    v_owned boolean;
begin
    if p_user_id is null or p_attempt_id is null or p_request_key is null
       or length(btrim(p_request_key)) not between 1 and 128 then
        raise exception 'Invalid AR grant.';
    end if;
    perform 1 from public.profiles where id=p_user_id for update;
    if not found then raise exception 'Profile not found.'; end if;
    select * into v_attempt from public.activity_attempts
        where id=p_attempt_id and user_id=p_user_id for update;
    if not found then raise exception 'AR attempt not found.'; end if;
    if v_attempt.activity_type <> 'ar' or v_attempt.ar_verified_at is null
       or v_attempt.ar_verification_ref is null or v_attempt.ar_team_id is null then
        raise exception 'Trusted AR verification required.';
    end if;
    v_key := public.reward_operation_key(p_user_id,'ar_mascot_unlock',btrim(p_request_key));
    select * into v_event from public.reward_events where idempotency_version=2 and idempotency_key=v_key;
    if found then
        if v_event.user_id is distinct from p_user_id or v_event.attempt_id is distinct from p_attempt_id
           or v_event.event_type is distinct from 'ar_mascot_unlock' or v_event.points_delta is distinct from 0
           or v_attempt.status <> 'completed' or not exists (
               select 1 from public.cards c join public.user_cards u on u.card_id=c.id
               where c.id=v_event.card_id and c.team_id=v_attempt.ar_team_id and u.user_id=p_user_id
                 and c.card_type='mascot' and c.unlock_method='ar' and c.cost=0) then
            raise exception 'AR operation state is inconsistent.';
        end if;
        return jsonb_build_object('card_id',v_event.card_id,'reward_id',v_event.id,
            'already_processed',true,'already_owned',coalesce((v_event.metadata->>'already_owned')::boolean,false));
    end if;
    if v_attempt.status <> 'started' then raise exception 'AR attempt is not active.'; end if;
    perform 1 from public.teams where id=v_attempt.ar_team_id and is_active for share;
    if not found then raise exception 'AR team not available.'; end if;
    if (select count(*) from public.cards where team_id=v_attempt.ar_team_id and is_active
        and card_type='mascot' and unlock_method='ar' and cost=0) <> 1 then
        raise exception 'AR mascot catalog is invalid.';
    end if;
    select * into v_card from public.cards where team_id=v_attempt.ar_team_id and is_active
        and card_type='mascot' and unlock_method='ar' and cost=0 for share;
    select exists(select 1 from public.user_cards where user_id=p_user_id and card_id=v_card.id) into v_owned;
    insert into public.user_cards(user_id,card_id,source) values(p_user_id,v_card.id,'ar')
        on conflict(user_id,card_id) do nothing;
    update public.activity_attempts set status='completed',completed_at=now() where id=p_attempt_id;
    insert into public.reward_events(user_id,attempt_id,event_type,points_delta,card_id,
        idempotency_key,idempotency_version,metadata)
        values(p_user_id,p_attempt_id,'ar_mascot_unlock',0,v_card.id,v_key,2,
            jsonb_build_object('source','ar','already_owned',v_owned)) returning * into v_event;
    return jsonb_build_object('card_id',v_card.id,'reward_id',v_event.id,
        'already_processed',false,'already_owned',v_owned);
end;
$$;

revoke all on function public.authorize_ar_mascot(uuid,text,text) from public,anon,authenticated;
revoke all on function public.grant_verified_ar_mascot(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.authorize_ar_mascot(uuid,text,text) to service_role;
grant execute on function public.grant_verified_ar_mascot(uuid,uuid,text) to service_role;

create function public.enforce_verified_ar_reward()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
    if new.event_type = 'ar_mascot_unlock' then
        if new.idempotency_version <> 2 or new.points_delta <> 0 or not exists (
            select 1 from public.activity_attempts a join public.cards c on c.team_id=a.ar_team_id
            where a.id=new.attempt_id and a.user_id=new.user_id and a.activity_type='ar'
              and a.ar_verified_at is not null and a.ar_verification_ref is not null
              and a.status='completed' and c.id=new.card_id and c.card_type='mascot'
              and c.unlock_method='ar' and c.cost=0
        ) then raise exception 'Trusted AR verification required.'; end if;
    elsif exists(select 1 from public.activity_attempts where id=new.attempt_id and ar_verified_at is not null) then
        raise exception 'Verified AR attempts only grant their mascot without points.';
    end if;
    return new;
end;
$$;
create trigger enforce_verified_ar_reward before insert or update on public.reward_events
    for each row execute function public.enforce_verified_ar_reward();
revoke all on function public.enforce_verified_ar_reward() from public,anon,authenticated;
grant execute on function public.enforce_verified_ar_reward() to service_role;
