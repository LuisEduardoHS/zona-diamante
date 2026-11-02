"""Three-miss survival: disposable LOCAL DB/Auth/API, with full regressions."""
import json
import logging
import sys
import time
from pathlib import Path
from uuid import uuid4
from urllib.parse import urlparse
from phase01_database import main,fixture_user,user,race,CheckFailure
from phase05_database import checks as previous_checks
from phase04_database import sql_command,RULES


def survival_checks(project):
    count=0
    def check(ok,label):
        nonlocal count
        count+=1
        if not ok:raise CheckFailure('Survival: '+label)
    def call(n,action,gid=None,**fields):
        return project.value('set role service_role; '+sql_command(user(n),action,gid,**fields)+';')
    for n in range(300,320):fixture_user(project,n,0)
    # Only in the owned disposable project. Fixtures move pitch deadlines;
    # every statistic still comes from the actual command/resolution functions.
    config=json.dumps(RULES).replace("'","''")
    helper="""
create function public.survival_qa_play(uid uuid, sequence jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare g jsonb; first_op jsonb; rev integer; pid uuid; key text; start_key text:=gen_random_uuid()::text;
 kind text; offset_ms numeric; old_flight numeric:=999999; i integer:=0; duplicate jsonb;
begin
 g:=public.game_beta_command(uid,'start',p_key=>start_key,p_mode=>'survival',p_rules=>'CONFIG'::jsonb);
 for j in 1..3 loop
  update public.activity_attempts set beta_game=jsonb_set(beta_game,'{probe_at}',to_jsonb(extract(epoch from clock_timestamp())*1000-20)) where id=(g->>'id')::uuid;
  g:=public.game_beta_command(uid,'probe',(g->>'id')::uuid,p_key=>gen_random_uuid()::text,p_revision=>(g->>'revision')::int,p_probe=>(g->>'probe')::uuid);
 end loop;
 for kind in select jsonb_array_elements_text(sequence) loop
  if g->>'phase'<>'waiting' then raise exception 'QA premature terminal';end if;
  update public.activity_attempts set beta_game=jsonb_set(beta_game,'{next_at}','0') where id=(g->>'id')::uuid;
  g:=public.game_beta_command(uid,'pitch',(g->>'id')::uuid,p_key=>gen_random_uuid()::text,p_revision=>(g->>'revision')::int);
  if (g->'plan'->>'flightMs')::numeric>=old_flight then raise exception 'QA speed did not increase';end if;
  old_flight:=(g->'plan'->>'flightMs')::numeric;
  rev:=(g->>'revision')::int;pid:=(g->>'pitch_id')::uuid;key:=gen_random_uuid()::text;
  if i=0 then first_op:=jsonb_build_object('key',key,'revision',rev,'pitch_id',pid);end if;
  offset_ms:=case when kind='hit' then (g->'plan'->>'contactMs')::numeric when kind='none' then 5000 else 1 end;
  update public.activity_attempts set beta_game=jsonb_set(beta_game,'{pitch_start}',to_jsonb(extract(epoch from clock_timestamp())*1000-offset_ms-(g->>'compensation_ms')::numeric)) where id=(g->>'id')::uuid;
  if kind='none' then g:=public.game_beta_command(uid,'read',(g->>'id')::uuid);
  else
   g:=public.game_beta_command(uid,'swing',(g->>'id')::uuid,p_key=>key,p_revision=>rev,p_pitch_id=>pid);
   duplicate:=public.game_beta_command(uid,'swing',(g->>'id')::uuid,p_key=>key,p_revision=>rev,p_pitch_id=>pid);
   if duplicate->'stats'<>g->'stats' then raise exception 'QA duplicate swing';end if;
  end if;
  i:=i+1;
  if (g->'stats'->>'resolved')::int<>i then raise exception 'QA one resolution per pitch';end if;
  if (g->'stats'->>'misses')::int<3 and g->>'outcome' is not null then raise exception 'QA early end';end if;
 end loop;
 return g||jsonb_build_object('_first',first_op,'_start_key',start_key);
end $$;
revoke all on function public.survival_qa_play(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.survival_qa_play(uuid,jsonb) to service_role;
""".replace('CONFIG',config)
    project.sql(helper)
    def play(n,sequence):
        literal=json.dumps(sequence).replace("'","''")
        return project.value(f"set role service_role; select public.survival_qa_play('{user(n)}','{literal}'::jsonb);")
    try:
        for hits,best,expected in [(0,0,0),(9,9,0),(10,4,35),(10,10,40),(11,11,45),(12,12,50),(15,15,65),(200,200,65)]:
            reward=project.value(f'set role service_role; select public.survival_game_reward({hits},{best});')
            check(reward['nominal_points']==expected,'reward '+str((hits,best,expected)))
        for role in ['anon','authenticated']:
            check(project.sql_result(f'set role {role}; select public.survival_game_reward(200,200);').returncode!=0,'private reward '+role)
            check(project.sql_result(f'set role {role}; select public.survival_pitch_plan(2);').returncode!=0,'private plan '+role)
        for n,hits in enumerate([0,9,10,11,12,20,200],300):
            g=play(n,['hit']*hits+['early']*3)
            check(g['version']=='survival-1' and g['phase']=='ready','terminal only on third miss')
            check(g['stats']['resolved']==hits+3 and g['stats']['hits']==hits and g['stats']['misses']==3,'stats '+str(hits))
            check(g['outcome']==('won' if hits>=10 else 'lost'),'goal '+str(hits))
            before=call(n,'read',g['id']);check(before['reward']['status']=='pending','no early credit')
            r=call(n,'complete',g['id'],p_key='finish')
            expected=0 if hits<10 else min(65,40+(hits-10)*5)
            check(r['reward']['points_awarded']==expected and r['points_balance']==expected,'server credit')
            again=call(n,'complete',g['id'],p_key='another')
            check(again['reward']['event_id']==r['reward']['event_id'] and again['points_balance']==expected,'resource idempotence')
            if hits==200:
                ring=project.value(f"select jsonb_build_object('history',jsonb_array_length(beta_game->'history'),'ops',(select count(*) from jsonb_object_keys(beta_game->'ops'))) from public.activity_attempts where id='{g['id']}';")
                check(ring['history']==32 and ring['ops']==128,'bounded memory, no command-based game cap')
                first=g['_first']
                stale=project.sql_result(sql_command(user(n),'swing',g['id'],p_key=first['key'],p_revision=first['revision'],p_pitch_id=first['pitch_id']))
                check(stale.returncode!=0,'evicted stale swing cannot be applied')
                check(call(n,'read',g['id'])['stats']==g['stats'],'evicted retry leaves stats unchanged')
                check(call(n,'start',p_key=g['_start_key'],p_mode='survival',p_rules=RULES)['id']==g['id'],'start key survives compaction')
        g=play(307,['hit']*11+['early','hit','early','early'])
        check(g['stats']['hits']==12 and g['stats']['bestStreak']==11 and g['stats']['misses']==3,'nonconsecutive misses, extras retained')
        g=play(308,['none']*3);check(g['stats']['resolved']==3 and g['stats']['misses']==3,'passive pitches count')
        check(call(308,'complete',g['id'],p_key='finish')['reward']['points_awarded']==0,'passive no reward')
        g=play(309,['hit']*10)
        check(g['phase']=='waiting' and g['outcome'] is None,'ten hits do not end game')
        check(project.sql_result(sql_command(user(309),'complete',g['id'],p_key='premature')).returncode!=0,'cannot claim at ten')
        # A live command renews idle TTL; no total eight-minute limit on play.
        project.sql(f"update public.activity_attempts set beta_game=jsonb_set(jsonb_set(beta_game,'{{next_at}}','0'),'{{expires_at}}',to_jsonb(extract(epoch from clock_timestamp())*1000+3000)) where id='{g['id']}';")
        g=call(309,'pitch',g['id'],p_key='renew',p_revision=g['revision'])
        check(g['expires_at']-g['server_now']>470000,'active TTL renewed')
        call(309,'abandon',g['id'],p_key='leave')
        for i in range(4):
            g=play(310,['hit']*20+['early']*3);r=call(310,'complete',g['id'],p_key='finish')
            check(r['reward']['points_awarded']==(65 if i<3 else 0),'daily cap '+str(i))
        check(r['points_balance']==195 and r['reward']['status']=='daily_limit','daily budget retained')
        g=play(311,['hit']*12+['early']*3)
        _,rows=race(project,sql_command(user(311),'complete',g['id'],p_key='one'),sql_command(user(311),'complete',g['id'],p_key='two'),2)
        check(rows[0]['reward']['event_id']==rows[1]['reward']['event_id'] and rows[0]['points_balance']==50,'concurrent completion one award')
        g=play(312,[]);g=call(312,'pitch',g['id'],p_key='pitch',p_revision=g['revision'])
        project.sql(f"update public.activity_attempts set beta_game=jsonb_set(beta_game,'{{pitch_start}}',to_jsonb(extract(epoch from clock_timestamp())*1000-100)) where id='{g['id']}';")
        cmd=sql_command(user(312),'swing',g['id'],p_key='one-swing',p_revision=g['revision'],p_pitch_id=g['pitch_id'])
        _,rows=race(project,cmd,cmd,2);check(rows[0]['stats']['resolved']==1 and rows[0]['stats']==rows[1]['stats'],'concurrent swing once')
        check(project.sql_result("select public.survival_game_reward(-1,0);").returncode!=0,'invalid reward stats')
        print(f'PASS: {count} survival SQL checks, 200-hit game, bounded replay/history, progressive speed, 2 concurrency scenarios',flush=True)
    finally:
        project.sql('drop function public.survival_qa_play(uuid,jsonb);')


def survival_http(project):
    import httpx
    from fastapi.testclient import TestClient
    sys.path.insert(0,str(Path(__file__).parents[1]))
    from app.core.config import settings
    from app.main import app
    local=json.loads(project.run_cli('status','--output','json'));api=local['API_URL']
    if urlparse(api).hostname not in ('127.0.0.1','localhost'):raise CheckFailure('Local only')
    fields=('supabase_url','supabase_publishable_key','supabase_secret_key');prior=tuple(getattr(settings,f) for f in fields)
    level=logging.getLogger('httpx').level;logging.getLogger('httpx').setLevel(logging.ERROR)
    try:
        settings.supabase_url=api;settings.supabase_publishable_key=local['ANON_KEY'];settings.supabase_secret_key=local['SERVICE_ROLE_KEY']
        tag=uuid4().hex;signup=httpx.post(api+'/auth/v1/signup',headers={'apikey':local['ANON_KEY']},json={'email':f'survival-{tag}@example.invalid','password':uuid4().hex,'data':{'username':'survival_'+tag}},timeout=15)
        if signup.status_code!=200:raise CheckFailure('Survival signup')
        auth={'Authorization':'Bearer '+signup.json()['access_token']};client=TestClient(app);base='/api/v1/games/beta'
        def post(path,body,key=None):
            r=client.post(base+path,json=body,headers={**auth,'Idempotency-Key':key or uuid4().hex})
            if r.status_code!=200:raise CheckFailure('Survival HTTP '+path+' '+str(r.status_code))
            return r.json()
        g=post('',{'mode':'survival'});gid=g['id']
        for _ in range(3):g=post('/'+gid+'/probe',{'probe':g['probe'],'expected_revision':g['revision']})
        previous=float('inf')
        while g['phase']!='ready':
            time.sleep(max(0,(g['next_at']-g['server_now'])/1000)+.01)
            g=post('/'+gid+'/pitches',{'expected_revision':g['revision']})
            if g['plan']['flightMs']>=previous:raise CheckFailure('Survival HTTP speed')
            previous=g['plan']['flightMs'];hit=g['stats']['resolved']<11
            offset=g['plan']['contactMs'] if hit else 100
            time.sleep(max(0,(g['pitch_start']+offset-g['server_now'])/1000))
            g=post('/'+gid+'/pitches/'+g['pitch_id']+'/swing',{'expected_revision':g['revision']})
            if hit and g['last']['type'] not in ('hit','perfect'):raise CheckFailure('Survival HTTP timed hit')
            if g['stats']['resolved']==10 and g['phase']!='waiting':raise CheckFailure('Survival HTTP early end')
        if g['stats']['hits']!=11 or g['stats']['misses']!=3 or g['stats']['resolved']!=14:raise CheckFailure('Survival HTTP totals')
        r=post('/'+gid+'/complete',{},'finish');again=post('/'+gid+'/complete',{},'finish')
        if r['reward']['points_awarded']!=45 or again['reward']['event_id']!=r['reward']['event_id']:raise CheckFailure('Survival HTTP credit/retry')
        if client.get('/api/v1/cards',headers=auth).json()['points_balance']!=45:raise CheckFailure('Survival HTTP collection')
        print('PASS: survival real Auth/FastAPI/PostgREST clock, 11 hits + 3 misses, 45 points once, collection persisted',flush=True)
    finally:
        for field,value in zip(fields,prior):setattr(settings,field,value)
        logging.getLogger('httpx').setLevel(level)


def checks(project):
    previous_checks(project)
    survival_checks(project)
    survival_http(project)


if __name__=='__main__':sys.exit(main(extra_checks=checks))
