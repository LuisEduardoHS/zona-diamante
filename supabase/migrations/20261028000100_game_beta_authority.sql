-- Forward-only beta protocol. Existing attempts, ledger and balances are reused.
alter table public.activity_attempts add column beta_game jsonb, add column beta_request_key text;
alter table public.activity_attempts add constraint beta_game_shape check ((
 (beta_game is null and beta_request_key is null) or
 (activity_type='game' and game_state is null and beta_request_key is not null
  and beta_game->>'version'='beta-1'
  and beta_game->>'mode' in ('classic','streak')
  and beta_game ?& array['rules','stats','ops','revision','expires_at','reward']
  and jsonb_typeof(beta_game->'stats')='object' and jsonb_typeof(beta_game->'ops')='object'
  and beta_game->>'phase' in ('waiting','pitch','paused','ready','settling','completed','abandoned','expired')
  and jsonb_typeof(beta_game->'history')='array'
  and jsonb_array_length(beta_game->'history')<=15
  and ((beta_game->>'phase'='completed' and status='completed')
    or (beta_game->>'phase'='abandoned' and status='rejected')
    or (beta_game->>'phase'='expired' and status='expired')
    or (beta_game->>'phase' in ('waiting','pitch','paused','ready','settling') and status='started')))) is true);
create unique index beta_game_start_key on public.activity_attempts(user_id,beta_request_key) where beta_game is not null;
create unique index beta_game_one_active on public.activity_attempts(user_id)
 where beta_game->>'phase' in ('waiting','pitch','paused','ready');
create index beta_reward_daily_count on public.reward_events(user_id,(metadata->>'reward_day'))
 where event_type='game_beta_completion' and points_delta>0;

-- Internal bridge to the established completion RPC. Settling exists only
-- inside its transaction; a failure rolls back the phase and all effects.
create function public.beta_completion_state() returns trigger language plpgsql
 security invoker set search_path=pg_catalog,public as $$
begin
 if old.beta_game->>'phase'='settling' and new.status='completed' then
  new.beta_game:=new.beta_game||jsonb_build_object('phase','completed');
 end if;
 return new;
end $$;
create trigger beta_completion_state before update of status on public.activity_attempts
 for each row execute function public.beta_completion_state();

-- Resolve only from DB time/receipt, never a client score or timestamp.
create function public.beta_resolve(g jsonb, kind text, received_ms numeric)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare s jsonb:=g->'stats'; n integer; streak integer; hits integer; outcome text; won boolean:=kind in ('hit','perfect');
begin
 n:=(s->>'resolved')::int+1; hits:=(s->>'hits')::int+won::int;
 streak:=case when won then (s->>'streak')::int+1 else 0 end;
 s:=jsonb_build_object('resolved',n,'hits',hits,'misses',(s->>'misses')::int+(not won)::int,
  'perfects',(s->>'perfects')::int+(kind='perfect')::int,'score',(s->>'score')::int+case kind when 'perfect' then 20 when 'hit' then 10 else 0 end,
  'streak',streak,'bestStreak',greatest((s->>'bestStreak')::int,streak),'swings',(s->>'swings')::int+(kind<>'no_swing')::int);
 if g->>'mode'='streak' and streak>=5 then outcome:='won';
 elsif n>=(case g->>'mode' when 'classic' then 10 else 15 end) then
  outcome:=case when g->>'mode'='classic' and hits>=6 then 'won' else 'lost' end;
 end if;
 return g || jsonb_build_object('phase',case when outcome is null then 'waiting' else 'ready' end,
  'revision',(g->>'revision')::int+1,'stats',s,'outcome',outcome,'next_at',received_ms+600,
  'last',jsonb_build_object('type',kind,'at',received_ms-(g->>'pitch_start')::numeric-(g->>'compensation_ms')::numeric,
    'resolved_at',received_ms,'duration',600,'pitch_id',g->>'pitch_id'),
  'history',(g->'history')||jsonb_build_array(jsonb_build_object('pitch_id',g->>'pitch_id','type',kind,
    'received_at',received_ms,'start_at',g->'pitch_start','plan',g->'plan')));
end $$;

create function public.game_beta_command(
 p_user_id uuid, p_action text, p_attempt_id uuid default null, p_key text default null,
 p_mode text default null, p_revision integer default null, p_pitch_id uuid default null,
 p_probe uuid default null, p_rules jsonb default null
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
 a public.activity_attempts%rowtype; g jsonb; now_ms numeric:=extract(epoch from clock_timestamp())*1000;
 balance integer; today date:=(clock_timestamp() at time zone 'America/Mexico_City')::date;
 used integer; v_key text; fingerprint text; prior jsonb; phase text; original_phase text;
 elapsed numeric; factor numeric; idx integer; tier integer; plan jsonb; sample numeric;
 points integer; reason text; completion jsonb; result jsonb;
begin
 if p_user_id is null or p_action not in ('start','current','read','probe','pitch','swing','pause','resume','abandon','complete') then
  raise exception 'Invalid beta command.'; end if;
 select points_balance into balance from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Profile not found.'; end if;
 today:=(clock_timestamp() at time zone 'America/Mexico_City')::date;
 select count(*) into used from public.reward_events where user_id=p_user_id and event_type='game_beta_completion'
  and points_delta>0 and metadata->>'reward_day'=today::text;

 if p_action='start' then
  if p_mode is null or p_mode not in ('classic','streak') or p_rules->>'version' is distinct from 'beta-1'
   or p_key is null or length(btrim(p_key)) not between 1 and 128 then raise exception 'Invalid beta command.'; end if;
  v_key:=public.reward_operation_key(p_user_id,'game:beta:start',btrim(p_key));
  select * into a from public.activity_attempts where user_id=p_user_id and beta_request_key=v_key for update;
  if found then
   if a.beta_game->>'mode'<>p_mode then raise exception 'Beta key conflict.'; end if;
  else
   update public.activity_attempts set beta_game=beta_game||jsonb_build_object('phase','expired','outcome',null),
    status='expired',completed_at=clock_timestamp()
    where user_id=p_user_id and beta_game->>'phase' in ('waiting','pitch','paused','ready')
     and (beta_game->>'expires_at')::numeric<=now_ms;
   if exists(select 1 from public.activity_attempts where user_id=p_user_id and beta_game->>'phase' in ('waiting','pitch','paused','ready'))
    then raise exception 'Beta already active.'; end if;
   if (select count(*) from public.activity_attempts where user_id=p_user_id and beta_game is not null
       and started_at>clock_timestamp()-interval '1 hour')>=30 then raise exception 'Beta start rate limit.'; end if;
   g:=jsonb_build_object('version','beta-1','mode',p_mode,'phase','waiting','revision',0,'rules',p_rules,
    'expires_at',now_ms+480000,'next_at',now_ms,'history','[]'::jsonb,'ops','{}'::jsonb,
    'probe',gen_random_uuid(),'probe_at',now_ms,'samples','[]'::jsonb,'compensation_ms',0,'pauses',0,
    'stats',jsonb_build_object('resolved',0,'hits',0,'misses',0,'perfects',0,'score',0,'streak',0,'bestStreak',0,'swings',0),
    'outcome',null,'last',null,'reward',jsonb_build_object('status','pending','points_awarded',null));
   insert into public.activity_attempts(user_id,activity_type,beta_game,beta_request_key)
    values(p_user_id,'game',g,v_key) returning * into a;
  end if;
 elsif p_action='current' then
  select * into a from public.activity_attempts where user_id=p_user_id and beta_game is not null
   order by started_at desc,id desc limit 1 for update;
  if not found then return null; end if;
 else
  select * into a from public.activity_attempts where id=p_attempt_id and user_id=p_user_id and beta_game is not null for update;
  if not found then raise exception 'Beta not found.'; end if;
 end if;
 g:=a.beta_game; phase:=g->>'phase';
 if phase in ('waiting','pitch','paused','ready') and (g->>'expires_at')::numeric<=now_ms then
  g:=g||jsonb_build_object('phase','expired','outcome',null,'revision',(g->>'revision')::int+1);
  update public.activity_attempts set beta_game=g,status='expired',completed_at=clock_timestamp() where id=a.id;
  phase:='expired';
 end if;
 -- Expiry is committed as a state, not raised/rolled back on access.
 if phase='expired' then p_action:='read'; end if;
 if p_action not in ('start','current','read') then
  if p_key is null or length(btrim(p_key)) not between 1 and 128 then raise exception 'Invalid beta command.'; end if;
  v_key:=encode(sha256(convert_to(btrim(p_key),'UTF8')),'hex');
  fingerprint:=jsonb_build_array(p_action,p_revision,p_pitch_id,p_probe)::text;
  prior:=g->'ops'->v_key;
  if prior is not null then
   if prior->>'fingerprint'<>fingerprint then raise exception 'Beta key conflict.'; end if;
   p_action:='read';
  elsif (select count(*) from jsonb_object_keys(g->'ops'))>=128 then raise exception 'Beta command limit.';
  end if;
 end if;
 original_phase:=phase;
 -- Read/timeout commits the same resolution as a late command. A paused pitch
 -- keeps its original deadline: pausing cannot create an unlimited hit window.
 if (phase='pitch' or (phase='paused' and g->>'paused_from'='pitch'))
    and now_ms>(g->>'pitch_start')::numeric+(g->'plan'->>'flightMs')::numeric+(g->>'compensation_ms')::numeric then
  g:=public.beta_resolve(g,'no_swing',now_ms); phase:=g->>'phase';
  if original_phase='paused' then g:=g||jsonb_build_object('paused_from',phase,'phase','paused');phase:='paused';end if;
 end if;
 if p_action not in ('start','current','read','complete','abandon') then
  if p_revision is null or p_revision<>(g->>'revision')::int then raise exception 'Beta revision conflict.'; end if;
 end if;
 if p_action='probe' then
  if phase<>'waiting' or jsonb_array_length(g->'history')<>0 or jsonb_array_length(g->'samples')>=3
   or p_probe is null or p_probe::text is distinct from g->>'probe' then raise exception 'Beta sequence conflict.'; end if;
  sample:=greatest(0,now_ms-(g->>'probe_at')::numeric);
  g:=g||jsonb_build_object('samples',(g->'samples')||to_jsonb(sample),'probe',gen_random_uuid(),'probe_at',now_ms,
    'revision',(g->>'revision')::int+1);
  select min(value::numeric) into sample from jsonb_array_elements_text(g->'samples');
  g:=g||jsonb_build_object('compensation_ms',least(160,sample));
 elsif p_action='pitch' then
  if phase<>'waiting' or now_ms<(g->>'next_at')::numeric or jsonb_array_length(g->'samples')<>3 then raise exception 'Beta sequence conflict.'; end if;
  select min(value::numeric) into sample from jsonb_array_elements_text(g->'samples');
  if sample>250 then raise exception 'Beta latency too high.';end if;
  idx:=(g->'stats'->>'resolved')::int+1;tier:=least((idx-1)/5,2);
  factor:=(array[1.0,.94,.88])[tier+1]*(.92+random()*.16);
  plan:=jsonb_build_object('flightMs',1400*factor,'contactMs',1200*factor,'validWindowMs',150*factor,
   'perfectWindowMs',50*factor,'index',idx,'tier',tier+1);
  g:=g||jsonb_build_object('phase','pitch','pitch_id',gen_random_uuid(),'pitch_start',now_ms+case when idx=1 then 3000 else 800 end,
   'plan',plan,'last',null,'revision',(g->>'revision')::int+1);
 elsif p_action='swing' then
  if phase<>'pitch' or p_pitch_id is null or p_pitch_id::text is distinct from g->>'pitch_id' then raise exception 'Beta sequence conflict.';end if;
  elapsed:=now_ms-(g->>'pitch_start')::numeric-(g->>'compensation_ms')::numeric;
  if elapsed<0 then raise exception 'Beta pitch not started.';end if;
  reason:=case when abs(elapsed-(g->'plan'->>'contactMs')::numeric)<=(g->'plan'->>'perfectWindowMs')::numeric then 'perfect'
    when abs(elapsed-(g->'plan'->>'contactMs')::numeric)<=(g->'plan'->>'validWindowMs')::numeric then 'hit'
    when elapsed<(g->'plan'->>'contactMs')::numeric then 'early' else 'late' end;
  g:=public.beta_resolve(g,reason,now_ms);
 elsif p_action='pause' then
  if phase not in ('pitch','waiting','ready') or (g->>'pauses')::int>=20 then raise exception 'Beta sequence conflict.';end if;
  g:=g||jsonb_build_object('phase','paused','paused_from',phase,'pauses',(g->>'pauses')::int+1,'revision',(g->>'revision')::int+1);
 elsif p_action='resume' then
  if phase<>'paused' then raise exception 'Beta sequence conflict.';end if;
  g:=g||jsonb_build_object('phase',g->>'paused_from','paused_from',null,'revision',(g->>'revision')::int+1);
 elsif p_action='abandon' then
  if phase not in ('completed','abandoned','expired') then
   g:=g||jsonb_build_object('phase','abandoned','outcome',null,'revision',(g->>'revision')::int+1);
   update public.activity_attempts set status='rejected',completed_at=clock_timestamp(),beta_game=g where id=a.id;
  end if;
 elsif p_action='complete' and phase<>'completed' then
  if phase<>'ready' or g->>'outcome' is null then raise exception 'Beta sequence conflict.';end if;
  -- No completion points for passive timeouts. At least three actual swings,
  -- full valid sequence, and server-enforced pitch/feedback durations required.
  reason:=case when (g->'rules'->'economy'->>'enabled')::boolean is not true then 'disabled'
   when (g->'stats'->>'swings')::int<3 then 'no_participation' when used>=3 then 'daily_limit' else 'confirmed' end;
  points:=case when reason<>'confirmed' then 0 else 10+case when g->>'outcome'='won' then case g->>'mode' when 'classic' then 40 else 50 end else 0 end end;
  g:=g||jsonb_build_object('phase','settling','reward_day',today,'revision',(g->>'revision')::int+1,
   'reward',jsonb_build_object('status',reason,'points_awarded',points));
  update public.activity_attempts set beta_game=g where id=a.id;
  completion:=public.complete_activity_attempt(p_user_id,a.id,'game_beta_completion','game:'||a.id::text,
   (g->'stats'->>'score')::int,points,
   jsonb_build_object('protocol','beta-1','mode',g->>'mode','outcome',g->>'outcome','reward_day',today));
  balance:=(completion->>'points_balance')::int;
  g:=g||jsonb_build_object('phase','completed','reward',(g->'reward')||jsonb_build_object('event_id',completion->>'reward_id'));
  if points>0 then used:=used+1;end if;
 end if;
 if p_action not in ('start','current','read') then
  v_key:=encode(sha256(convert_to(btrim(p_key),'UTF8')),'hex');
  g:=jsonb_set(g,array['ops',v_key],jsonb_build_object('fingerprint',fingerprint),true);
 end if;
 update public.activity_attempts set beta_game=g where id=a.id;
 result:=(g-'ops'-'probe_at')||jsonb_build_object('id',a.id,'server_now',extract(epoch from clock_timestamp())*1000,
   'points_balance',balance,'rewarded_today',used,'daily_limit',3);
 return result;
end $$;

create or replace function public.block_unvalidated_game_reward()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.activity_attempts%rowtype;
begin
 select * into a from public.activity_attempts where id=new.attempt_id;
 if a.game_state is not null then raise exception 'Game rewards are disabled pending server validation.';end if;
 if a.beta_game is not null and (new.event_type<>'game_beta_completion' or a.status<>'completed'
   or a.beta_game->>'phase'<>'completed' or new.user_id<>a.user_id
   or new.points_delta<>(a.beta_game->'reward'->>'points_awarded')::int
   or new.idempotency_version<>2
   or new.idempotency_key<>public.reward_operation_key(a.user_id,'activity:game:game_beta_completion','game:'||a.id::text)) then
  raise exception 'Unverified beta reward.';end if;
 return new;
end $$;
revoke all on function public.beta_resolve(jsonb,text,numeric) from public,anon,authenticated;
revoke all on function public.beta_completion_state() from public,anon,authenticated;
revoke all on function public.game_beta_command(uuid,text,uuid,text,text,integer,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.beta_resolve(jsonb,text,numeric) to service_role;
grant execute on function public.game_beta_command(uuid,text,uuid,text,text,integer,uuid,uuid,jsonb) to service_role;
