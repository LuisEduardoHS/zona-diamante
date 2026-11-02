"""Phase 5 on disposable, unlinked LOCAL Supabase. Includes legacy regression."""
import sys
import time
from uuid import uuid4
from pathlib import Path
import json
import logging
from urllib.parse import urlparse

from phase01_database import main, fixture_user, user, race, CheckFailure
from phase04_database import checks as previous_checks, sql_command, RULES


def unified_checks(project):
    count=0
    def check(ok,label):
        nonlocal count
        count+=1
        if not ok:raise CheckFailure('Unified: '+label)
    def call(n,action,gid=None,**fields):
        return project.value('set role service_role; '+sql_command(user(n),action,gid,**fields)+';')
    def start(n,key=None):
        return call(n,'start',p_key=key or uuid4().hex,p_mode='unified',p_rules=RULES)
    def play(n,sequence):
        g=start(n)
        for _ in range(3):
            shift=f"update public.activity_attempts set beta_game=jsonb_set(beta_game,'{{probe_at}}',to_jsonb(extract(epoch from clock_timestamp())*1000-40)) where id='{g['id']}';"
            g=project.value(shift+'set role service_role; '+sql_command(user(n),'probe',g['id'],p_key=uuid4().hex,p_revision=g['revision'],p_probe=g['probe'])+';')
        for i,kind in enumerate(sequence):
            check(g['phase']=='waiting',f'not terminal before shot {i+1}')
            project.sql(f"update public.activity_attempts set beta_game=jsonb_set(beta_game,'{{next_at}}','0') where id='{g['id']}';")
            g=call(n,'pitch',g['id'],p_key=uuid4().hex,p_revision=g['revision'])
            offset=g['plan']['contactMs'] if kind else 1
            if kind is None:
                shift=f"update public.activity_attempts set beta_game=jsonb_set(beta_game,'{{pitch_start}}',to_jsonb(extract(epoch from clock_timestamp())*1000-5000)) where id='{g['id']}';"
                g=project.value(shift+'set role service_role; '+sql_command(user(n),'read',g['id'])+';')
            else:
                shift=f"update public.activity_attempts set beta_game=jsonb_set(beta_game,'{{pitch_start}}',to_jsonb(extract(epoch from clock_timestamp())*1000-{offset}-{g['compensation_ms']})) where id='{g['id']}';"
                cmd=sql_command(user(n),'swing',g['id'],p_key=uuid4().hex,p_revision=g['revision'],p_pitch_id=g['pitch_id'])
                g=project.value(shift+'set role service_role; '+cmd+';')
                replay=project.value('set role service_role; '+cmd+';')
                check(replay['stats']==g['stats'],'swing retry same stats')
            check(g['stats']['resolved']==i+1,'one resolution per pitch')
        check(g['phase']=='ready' and g['stats']['resolved']==10,'all ten shots')
        return g
    for n in range(200,220):fixture_user(project,n,0)
    # Exact canonical formula, including the inconsistent 8-hit reference (55).
    for hits,best,expected in [(0,0,0),(3,2,0),(4,4,0),(5,2,30),(6,2,35),(7,3,45),(8,5,55),(10,10,65)]:
        r=project.value(f'set role service_role; select public.unified_game_reward({hits},{best});')
        check(r['nominal_points']==expected,f'formula {hits}/{best} = {expected}')
    for role in ['anon','authenticated']:
        check(project.sql_result(f'set role {role}; select public.unified_game_reward(10,10);').returncode!=0,'private formula '+role)
    check(project.sql_result('select public.unified_game_reward(11,11);').returncode!=0,'bounded statistics')
    cases=[([None]*10,0,0),([1,1,0,1,1,0,0,0,0,0],0,4),([1,1,0,1,1,0,1,0,0,0],30,5),
           ([1,1,0,1,1,0,1,1,0,0],35,6),([1,1,1,0,1,1,0,1,1,0],45,7),
           ([1,1,1,1,1,0,1,1,1,0],55,8),([1]*10,65,10)]
    for n,(sequence,points,hits) in enumerate(cases,200):
        g=play(n,sequence);check(g['version']=='unified-1','protocol version')
        check(g['stats']['hits']==hits,'actual hits')
        check(g['outcome']==('won' if hits>=5 else 'lost'),'server outcome')
        r=call(n,'complete',g['id'],p_key='finish')
        check(r['reward']['points_awarded']==points and r['points_balance']==points,'credit expected')
        again=call(n,'complete',g['id'],p_key='other-key')
        check(again['reward']['event_id']==r['reward']['event_id'] and again['points_balance']==points,'lost response recovery and resource idempotence')
    for i in range(4):
        g=play(210,[1]*10);r=call(210,'complete',g['id'],p_key='finish')
        check(r['reward']['points_awarded']==(65 if i<3 else 0),'daily quota '+str(i))
    check(r['points_balance']==195 and r['reward']['status']=='daily_limit' and r['reward']['nominal_points']==65,'quota retains nominal separate')
    g=play(211,[1]*10)
    _,rows=race(project,sql_command(user(211),'complete',g['id'],p_key='one'),sql_command(user(211),'complete',g['id'],p_key='two'),2)
    check(rows[0]['reward']['event_id']==rows[1]['reward']['event_id'],'concurrent close one event')
    check(project.sql(f"select points_balance from public.profiles where id='{user(211)}';")=='65','concurrent close one credit')
    _,rows=race(project,sql_command(user(212),'start',p_key='same',p_mode='unified',p_rules=RULES),sql_command(user(212),'start',p_key='same',p_mode='unified',p_rules=RULES),2)
    check(rows[0]['id']==rows[1]['id'],'concurrent start same ID')
    # Upgrade does not change a completed legacy reward. Existing suite also
    # executes legacy classic/streak matches under the new migration.
    check(project.sql("select count(*) from public.activity_attempts where beta_game->>'mode'='streak' and beta_game->>'version'='beta-1' and status='completed';")!='0','historical beta readable')
    print(f'PASS: {count} unified SQL checks, 2 concurrency scenarios; canonical rewards 0/30/35/45/55/65',flush=True)


def unified_http(project):
    """Real Auth/FastAPI/PostgREST and real clock, no synthetic scoring."""
    import httpx
    from fastapi.testclient import TestClient
    sys.path.insert(0,str(Path(__file__).parents[1]))
    from app.core.config import settings
    from app.main import app
    local=json.loads(project.run_cli('status','--output','json'))
    api=local['API_URL']
    if urlparse(api).hostname not in ('127.0.0.1','localhost'):raise CheckFailure('Local only')
    fields=('supabase_url','supabase_publishable_key','supabase_secret_key')
    previous=tuple(getattr(settings,f) for f in fields)
    level=logging.getLogger('httpx').level;logging.getLogger('httpx').setLevel(logging.ERROR)
    try:
        settings.supabase_url=api;settings.supabase_publishable_key=local['ANON_KEY'];settings.supabase_secret_key=local['SERVICE_ROLE_KEY']
        tag=uuid4().hex
        signup=httpx.post(api+'/auth/v1/signup',headers={'apikey':local['ANON_KEY']},json={'email':f'unified-{tag}@example.invalid','password':uuid4().hex,'data':{'username':'unified_'+tag}},timeout=15)
        if signup.status_code!=200:raise CheckFailure('Unified local signup')
        data=signup.json();auth={'Authorization':'Bearer '+data['access_token']}
        client=TestClient(app);base='/api/v1/games/beta'
        def post(path,body,key=None):
            response=client.post(base+path,json=body,headers={**auth,'Idempotency-Key':key or uuid4().hex})
            if response.status_code!=200:raise CheckFailure('Unified HTTP '+path+' '+str(response.status_code))
            return response.json()
        g=post('',{'mode':'unified'},'start');gid=g['id']
        for _ in range(3):g=post('/'+gid+'/probe',{'probe':g['probe'],'expected_revision':g['revision']})
        while g['phase']!='ready':
            time.sleep(max(0,(g['next_at']-g['server_now'])/1000)+.01)
            g=post('/'+gid+'/pitches',{'expected_revision':g['revision']})
            time.sleep(max(0,(g['pitch_start']+g['plan']['contactMs']-g['server_now'])/1000))
            g=post('/'+gid+'/pitches/'+g['pitch_id']+'/swing',{'expected_revision':g['revision']})
            if g['last']['type'] not in ('perfect','hit'):raise CheckFailure('Unified real time hit')
        if g['stats']['resolved']!=10 or g['stats']['hits']!=10:raise CheckFailure('Unified ten real pitches')
        r=post('/'+gid+'/complete',{},'finish')
        if r['reward']['points_awarded']!=65 or r['points_balance']!=65:raise CheckFailure('Unified real credit')
        recovered=post('/'+gid+'/complete',{},'finish')
        if recovered['reward']['event_id']!=r['reward']['event_id']:raise CheckFailure('Unified HTTP retry')
        if client.get('/api/v1/cards',headers=auth).json()['points_balance']!=65:raise CheckFailure('Unified collection balance')
        print('PASS: unified real HTTP/Auth/DB, 10 real-time hits, 65 points, idempotent close, collection balance',flush=True)
    finally:
        for field,value in zip(fields,previous):setattr(settings,field,value)
        logging.getLogger('httpx').setLevel(level)


def checks(project):
    previous_checks(project)
    unified_checks(project)
    unified_http(project)


if __name__=='__main__':sys.exit(main(extra_checks=checks))
