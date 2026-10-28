"""Disposable LOCAL Supabase only; no deployment or remote credentials."""
import json
import logging
import sys
import time
from pathlib import Path
from uuid import uuid4
from urllib.parse import urlparse

from phase01_database import main, fixture_user, user, race, CheckFailure
from phase02b_database import checks as previous_checks

RULES = json.loads((Path(__file__).parents[1] / 'app/core/game_beta_rules.json').read_text(encoding='utf-8'))


def sql_command(uid, action, gid=None, **fields):
    values = dict(p_user_id=uid, p_action=action, p_attempt_id=gid, **fields)
    def literal(value):
        if value is None:
            return 'null'
        if isinstance(value, dict):
            return "'" + json.dumps(value).replace("'", "''") + "'::jsonb"
        if isinstance(value, int):
            return str(value)
        return "'" + str(value).replace("'", "''") + "'"
    return 'select public.game_beta_command(' + ','.join(k + '=>' + literal(v) for k, v in values.items()) + ')'


def beta_checks(project):
    """SQL time fixtures shift DB pitch deadlines, never client input."""
    count = 0
    def diagnostic_sql(sql):
        value=project.sql_result(sql)
        if value.returncode:
            # Only synthetic SQL fixtures enter here, never Auth tokens/config.
            raise CheckFailure('Beta SQL: '+value.stderr[:3000])
        return value.stdout.strip()
    project.sql=diagnostic_sql
    def check(ok, label):
        nonlocal count
        count += 1
        if not ok:
            raise CheckFailure('Beta SQL check: ' + label)
    def call(uid, action, gid=None, **fields):
        return project.value('set role service_role; ' + sql_command(uid, action, gid, **fields) + ';')
    def new(n, mode='classic', key=None):
        uid=user(n)
        g=call(uid,'start',p_key=key or uuid4().hex,p_mode=mode,p_rules=RULES)
        for _ in range(3):
            shift=f"update public.activity_attempts set beta_game=jsonb_set(beta_game,'{{probe_at}}',to_jsonb(extract(epoch from clock_timestamp())*1000-40)) where id='{g['id']}'; "
            g=project.value(shift+'set role service_role; '+sql_command(uid,'probe',g['id'],p_key=uuid4().hex,p_revision=g['revision'],p_probe=g['probe'])+';')
        return g
    def play(n, mode='classic', win=True, swing_count=100):
        uid=user(n);g=new(n,mode)
        while g['phase']!='ready':
            project.sql(f"update public.activity_attempts set beta_game=jsonb_set(beta_game,'{{next_at}}','0') where id='{g['id']}';")
            g=call(uid,'pitch',g['id'],p_key=uuid4().hex,p_revision=g['revision'])
            hit=win or g['stats']['resolved']%3!=2
            if g['stats']['resolved']>=swing_count:
                project.sql(f"update public.activity_attempts set beta_game=jsonb_set(beta_game,'{{pitch_start}}',to_jsonb(extract(epoch from clock_timestamp())*1000-5000)) where id='{g['id']}';")
                g=call(uid,'read',g['id'])
            else:
                offset=g['plan']['contactMs'] if hit else 1
                shift=f"update public.activity_attempts set beta_game=jsonb_set(beta_game,'{{pitch_start}}',to_jsonb(extract(epoch from clock_timestamp())*1000-{offset}-{g['compensation_ms']})) where id='{g['id']}'; "
                g=project.value(shift+'set role service_role; '+sql_command(uid,'swing',g['id'],p_key=uuid4().hex,p_revision=g['revision'],p_pitch_id=g['pitch_id'])+';')
        return g
    for n in range(50,64):
        fixture_user(project,n,0)
    malformed=project.sql_result(f"insert into public.activity_attempts(user_id,activity_type,beta_request_key,beta_game) values('{user(50)}','game','malformed','{{}}');")
    check(malformed.returncode!=0 and 'beta_game_shape' in malformed.stderr,'null or missing JSON fields cannot bypass CHECK')
    a=call(user(50),'start',p_key='same',p_mode='classic',p_rules=RULES)
    check(call(user(50),'start',p_key='same',p_mode='classic',p_rules=RULES)['id']==a['id'],'start retry')
    check(project.sql_result(sql_command(user(50),'start',p_key='other',p_mode='classic',p_rules=RULES)).returncode!=0,'single active')
    check(project.sql_result(sql_command(user(51),'read',a['id'])).returncode!=0,'owner')
    check(project.sql_result(sql_command(user(50),'complete',a['id'],p_key='fake')).returncode!=0,'cannot complete unplayed')
    check(project.sql_result(f"set role anon; {sql_command(user(50),'read',a['id'])}").returncode!=0,'anon rpc')
    check(project.sql_result(f"set role authenticated; {sql_command(user(50),'read',a['id'])}").returncode!=0,'authenticated rpc')
    check(project.sql_result(f"select public.complete_activity_attempt('{user(50)}','{a['id']}','fake','fake',999,9999)").returncode!=0,'generic reward blocked')
    g=play(51,'classic');check(g['outcome']=='won' and g['stats']['resolved']==10,'classic rule')
    r=call(user(51),'complete',g['id'],p_key='finish');check(r['reward']['points_awarded']==50 and r['points_balance']==50,'classic fifty')
    r2=call(user(51),'complete',g['id'],p_key='other');check(r2['reward']['event_id']==r['reward']['event_id'] and r2['points_balance']==50,'resource idempotence')
    g=play(52,'streak');check(g['stats']['resolved']==5,'streak early win')
    r=call(user(52),'complete',g['id'],p_key='finish');check(r['reward']['points_awarded']==60,'streak sixty')
    g=play(53,'streak',False);check(g['outcome']=='lost' and g['stats']['resolved']==15,'streak loss')
    check(call(user(53),'complete',g['id'],p_key='finish')['reward']['points_awarded']==10,'loss ten')
    g=play(54,'classic',False,0);r=call(user(54),'complete',g['id'],p_key='finish')
    check(r['reward']['status']=='no_participation' and r['points_balance']==0,'idle no reward')
    for i in range(4):
        g=play(55,'streak');r=call(user(55),'complete',g['id'],p_key='finish')
        check(r['reward']['points_awarded']==(60 if i<3 else 0),'daily cap '+str(i))
    check(r['reward']['status']=='daily_limit' and r['points_balance']==180,'cap persisted')
    project.sql(f"update public.reward_events set metadata=metadata||jsonb_build_object('reward_day',(clock_timestamp() at time zone 'America/Mexico_City')::date-1) where id=(select id from public.reward_events where user_id='{user(55)}' and points_delta>0 and event_type='game_beta_completion' order by created_at limit 1);")
    g=play(55,'streak');r=call(user(55),'complete',g['id'],p_key='finish')
    check(r['reward']['points_awarded']==60 and r['points_balance']==240 and r['rewarded_today']==3,'new day quota uses persisted decision day')
    g=new(56);gid=g['id']
    project.sql(f"update public.activity_attempts set beta_game=jsonb_set(beta_game,'{{expires_at}}','0') where id='{gid}';")
    check(call(user(56),'complete',gid,p_key='finish')['phase']=='expired','expiry no award')
    g=new(57);g=call(user(57),'abandon',g['id'],p_key='exit')
    check(g['phase']=='abandoned' and g['outcome'] is None,'abandon')
    check(project.sql_result(sql_command(user(57),'complete',g['id'],p_key='finish')).returncode!=0,'abandon cannot reward')
    g=play(58,'streak');gid=g['id']
    project.sql("""create function public.beta_test_fail() returns trigger language plpgsql as $$ begin
      if new.event_type='game_beta_completion' then raise exception 'beta injected fault';end if;return new;end $$;
      create trigger beta_test_fail before insert on public.reward_events for each row execute function public.beta_test_fail();""")
    check(project.sql_result(sql_command(user(58),'complete',gid,p_key='finish')).returncode!=0,'fault raised')
    check(call(user(58),'read',gid)['phase']=='ready','attempt rolled back')
    check(project.sql(f"select points_balance from public.profiles where id='{user(58)}'")=='0','balance rolled back')
    check(project.sql(f"select count(*) from public.reward_events where attempt_id='{gid}'")=='0','ledger rolled back')
    project.sql('drop trigger beta_test_fail on public.reward_events;drop function public.beta_test_fail();')
    check(call(user(58),'complete',gid,p_key='finish')['points_balance']==60,'retry after rollback')
    # Actual independent PostgreSQL sessions, same profile lock as purchases.
    g=play(59,'streak');gid=g['id']
    _,rows=race(project,sql_command(user(59),'complete',gid,p_key='one'),sql_command(user(59),'complete',gid,p_key='two'),2)
    check(rows[0]['reward']['event_id']==rows[1]['reward']['event_id'],'concurrent finalization')
    check(rows[0]['points_balance']==60 and rows[1]['points_balance']==60,'one credit')
    _,rows=race(project,sql_command(user(60),'start',p_key='same',p_mode='classic',p_rules=RULES),sql_command(user(60),'start',p_key='same',p_mode='classic',p_rules=RULES),2)
    check(rows[0]['id']==rows[1]['id'],'concurrent start')
    check(project.sql(f"select count(*) from public.reward_events where user_id='{user(59)}' and event_type='game_beta_completion'")=='1','one ledger event')
    # Balance can be spent by the unchanged collection RPC; no catalog mutation.
    from phase01_database import purchase
    project.sql(f"update public.profiles set points_balance=940 where id='{user(63)}';insert into public.reward_events(user_id,event_type,points_delta,idempotency_key) values('{user(63)}','test_funding',940,'beta-test-funding-extra');")
    g=play(63,'streak');
    race(project,sql_command(user(63),'complete',g['id'],p_key='finish'),purchase(63,'sultanes-de-monterrey','after-game'),2)
    card_cost=int(project.sql("select cost from public.cards where slug='sultanes-de-monterrey'"))
    check(project.sql(f"select points_balance from public.profiles where id='{user(63)}'")==str(1000-card_cost),'purchase concurrently with game completion')
    check(project.sql(f"select count(*) from public.user_cards where user_id='{user(63)}'")=='1','inventory preserved')
    g=new(61);g=call(user(61),'pitch',g['id'],p_key='pitch',p_revision=g['revision'])
    project.sql(f"update public.activity_attempts set beta_game=jsonb_set(beta_game,'{{pitch_start}}',to_jsonb(extract(epoch from clock_timestamp())*1000-1000)) where id='{g['id']}';")
    command=sql_command(user(61),'swing',g['id'],p_key='same-swing',p_revision=g['revision'],p_pitch_id=g['pitch_id'])
    _,rows=race(project,command,command,2)
    check(rows[0]['stats']['resolved']==1 and rows[0]['stats']==rows[1]['stats'],'two tabs same swing')
    race(project,sql_command(user(62),'start',p_key='one',p_mode='classic',p_rules=RULES),sql_command(user(62),'start',p_key='two',p_mode='streak',p_rules=RULES),1)
    check(project.sql(f"select count(*) from public.activity_attempts where user_id='{user(62)}' and beta_game is not null")=='1','two tabs different starts')
    print(f'PASS: {count} beta SQL checks, 5 concurrent scenarios, reward/collection/rollback',flush=True)


def http_checks(project):
    import httpx
    from fastapi.testclient import TestClient
    sys.path.insert(0,str(Path(__file__).parents[1]))
    from app.core.config import settings
    from app.main import app
    local=json.loads(project.run_cli('status','--output','json'))
    api=local['API_URL']
    if urlparse(api).hostname not in ('localhost','127.0.0.1'):raise CheckFailure('Local Auth required')
    fields=('supabase_url','supabase_publishable_key','supabase_secret_key')
    previous=tuple(getattr(settings,f) for f in fields)
    http_level=logging.getLogger('httpx').level;logging.getLogger('httpx').setLevel(logging.ERROR)
    count=0
    def check(ok,label):
        nonlocal count
        count+=1
        if not ok:raise CheckFailure('Beta HTTP: '+label)
    try:
        settings.supabase_url=api;settings.supabase_publishable_key=local['ANON_KEY'];settings.supabase_secret_key=local['SERVICE_ROLE_KEY']
        client=TestClient(app);base='/api/v1/games/beta'
        check(client.post(base,json={'mode':'classic'},headers={'Idempotency-Key':'new'}).status_code==401,'auth required')
        check(client.get(base+'/current',headers={'Authorization':'Bearer invalid'}).status_code==401,'invalid JWT')
        accounts=[]
        for _ in range(2):
            tag=uuid4().hex
            response=httpx.post(api+'/auth/v1/signup',headers={'apikey':local['ANON_KEY']},
                json={'email':f'beta-{tag}@example.invalid','password':uuid4().hex,'data':{'username':'beta_'+tag}},timeout=15)
            check(response.status_code==200,'signup');data=response.json()
            accounts.append((data['user']['id'],{'Authorization':'Bearer '+data['access_token']}))
        uid,auth=accounts[0];_,other=accounts[1]
        def post(path,body,key=None):
            response=client.post(base+path,json=body,headers={**auth,'Idempotency-Key':key or uuid4().hex})
            check(response.status_code==200,'command '+path+' status '+str(response.status_code))
            return response.json()
        g=post('',{'mode':'streak'},'stable-start');gid=g['id']
        check(post('',{'mode':'streak'},'stable-start')['id']==gid,'start retry')
        check(client.get(base+'/'+gid,headers=other).status_code==404,'foreign match')
        check(client.get(base+'/'+str(uuid4()),headers=auth).status_code==404,'missing match')
        check(client.post(base+'/'+gid+'/complete',json={'win':True,'points':999999},headers={**auth,'Idempotency-Key':'fake'}).status_code==422,'forged result')
        check(client.post(base+'/'+gid+'/complete',json={},headers={**auth,'Idempotency-Key':'premature'}).status_code==409,'premature finish')
        for _ in range(3):g=post('/'+gid+'/probe',{'probe':g['probe'],'expected_revision':g['revision']})
        # Real elapsed time, real Auth/HTTP/PostgREST; no DB clock edits here.
        while g['phase']!='ready':
            time.sleep(max(0,(g['next_at']-g['server_now'])/1000)+.01)
            g=post('/'+gid+'/pitches',{'expected_revision':g['revision']})
            anchor=time.monotonic()
            delay=(g['pitch_start']+g['plan']['contactMs']-g['server_now'])/1000
            time.sleep(max(0,delay-(time.monotonic()-anchor)))
            key=uuid4().hex;pitch=g['pitch_id'];revision=g['revision']
            g=post('/'+gid+'/pitches/'+pitch+'/swing',{'expected_revision':revision},key)
            check(g['last']['type'] in ('perfect','hit'),'real timed hit')
            check(post('/'+gid+'/pitches/'+pitch+'/swing',{'expected_revision':revision},key)['stats']==g['stats'],'swing retry')
        check(g['outcome']=='won' and g['stats']['resolved']==5,'real streak win')
        result=post('/'+gid+'/complete',{},'finish')
        check(result['reward']['points_awarded']==60 and result['points_balance']==60,'real credit')
        # Simulate lost response: no replay calculation, read persisted result.
        recovered=client.get(base+'/'+gid,headers=auth).json()
        check(recovered['reward']['event_id']==result['reward']['event_id'],'lost response recovery')
        check(post('/'+gid+'/complete',{},'different-key')['points_balance']==60,'finish resource retry')
        catalog=client.get('/api/v1/cards',headers=auth).json()
        check(catalog['points_balance']==60,'collection persisted balance')
        # A second independent client with the same valid JWT sees the DB balance.
        second=TestClient(app)
        check(second.get('/api/v1/cards',headers=auth).json()['points_balance']==60,'second session balance')
        print(f'PASS: {count} real local Auth/FastAPI/PostgREST beta checks, real-time five-hit victory, persistent 60 points',flush=True)
    finally:
        for field,value in zip(fields,previous):setattr(settings,field,value)
        logging.getLogger('httpx').setLevel(http_level)


def checks(project):
    previous_checks(project)
    beta_checks(project)
    http_checks(project)


if __name__=='__main__':
    sys.exit(main(extra_checks=beta_checks if '--beta-only' in sys.argv else checks))
