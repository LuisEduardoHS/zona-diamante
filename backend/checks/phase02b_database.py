"""Disposable local SQL/Auth/PostgREST checks; includes Phases 1 and 2A."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from phase01_database import CheckFailure, fixture_user, main, race, user
from phase02a_database import phase02a_checks


def ar_checks(project):
    for n in range(30,35):
        fixture_user(project,n,1000)
    def authorize(n,team,ref):
        return project.sql(f"set role service_role; select public.authorize_ar_mascot('{user(n)}','{team}','{ref}');")
    def grant(n,attempt,key):
        return f"select public.grant_verified_ar_mascot('{user(n)}','{attempt}','{key}')"
    # Identical authorization requests converge before any grant is possible.
    # race() expects object JSON. Wrap the UUID rather than weakening its parser.
    statement=f"select jsonb_build_object('id',public.authorize_ar_mascot('{user(30)}','charros-jal','race-ar-30'))"
    _,rows=race(project,statement,statement,2)
    if rows[0]['id'] != rows[1]['id']: raise CheckFailure('Duplicate AR authorization')
    attempt=rows[0]['id']
    _,rows=race(project,grant(30,attempt,'same'),grant(30,attempt,'same'),2)
    if sorted(row['already_processed'] for row in rows) != [False,True]: raise CheckFailure('Duplicate AR grant')
    attempt=authorize(31,'sultanes-mty','race-ar-31')
    results,_=race(project,grant(31,attempt,'one'),grant(31,attempt,'two'),1)
    if not any('AR attempt is not active.' in r.stderr for r in results if r.returncode): raise CheckFailure('Unexpected AR race failure')
    a=authorize(32,'charros-jal','race-ar-32a'); b=authorize(32,'sultanes-mty','race-ar-32b')
    results,_=race(project,grant(32,a,'shared'),grant(32,b,'shared'),1)
    if not any('AR operation state is inconsistent.' in r.stderr for r in results if r.returncode): raise CheckFailure('AR key collision failed unsafely')
    a=authorize(33,'algodoneros-ul','race-ar-33'); b=authorize(34,'algodoneros-ul','race-ar-34')
    race(project,grant(33,a,'shared'),grant(34,b,'shared'),2)
    for n in range(30,35):
        state=project.value(f"select jsonb_build_object('balance',points_balance,'cards',(select count(*) from public.user_cards where user_id=p.id),'events',(select count(*) from public.reward_events where user_id=p.id and event_type='ar_mascot_unlock')) from public.profiles p where id='{user(n)}';")
        if state != dict(balance=1000,cards=1,events=1): raise CheckFailure('AR race changed balance or duplicated grant')
    print('PASS: 5 concurrent AR scenarios; inventory/ledger atomic and points unchanged',flush=True)

    # Real Auth/ASGI/PostgREST was initialized by phase02a_checks; add an isolated
    # read-only HTTP check with fresh synthetic user and no identity override.
    import json
    import logging
    import httpx
    from uuid import uuid4
    from urllib.parse import urlparse
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.config import settings
    local=json.loads(project.run_cli('status','--output','json'))
    api=local['API_URL']
    if urlparse(api).hostname not in ('localhost','127.0.0.1'): raise CheckFailure('Non-local AR HTTP target')
    fields=('supabase_url','supabase_publishable_key','supabase_secret_key')
    previous=tuple(getattr(settings,f) for f in fields)
    log_level=logging.getLogger('httpx').level
    logging.getLogger('httpx').setLevel(logging.ERROR)
    try:
        settings.supabase_url=api; settings.supabase_publishable_key=local['ANON_KEY']; settings.supabase_secret_key=local['SERVICE_ROLE_KEY']
        tag=uuid4().hex
        account=httpx.post(api+'/auth/v1/signup',headers={'apikey':local['ANON_KEY']},json={'email':f'ar-http-{tag}@example.invalid','password':uuid4().hex,'data':{'username':'ar_http_'+tag}},timeout=10)
        if account.status_code != 200: raise CheckFailure('Local AR Auth fixture failed')
        auth={'Authorization':'Bearer '+account.json()['access_token']}
        uid=account.json()['user']['id']
        client=TestClient(app)
        if client.get('/api/v1/ar/mascots').status_code != 401: raise CheckFailure('AR read exposed anonymously')
        response=client.get('/api/v1/ar/mascots',headers=auth)
        if response.status_code != 200 or len(response.json()['mascots']) != 4: raise CheckFailure('AR catalog HTTP failure')
        if any(m['is_owned'] or m['browser_claim_enabled'] for m in response.json()['mascots']): raise CheckFailure('AR false ownership/claim enabled')
        for route in ('claim','verify','unlock','authorize'):
            if client.post('/api/v1/ar/'+route,headers=auth,json={'marker_found':True,'team_slug':'charros-jal'}).status_code != 404: raise CheckFailure('AR browser grant exposed')
        attempt=project.sql(f"set role service_role; select public.authorize_ar_mascot('{uid}','charros-jal','http-proof-{tag}');")
        project.sql(f"set role service_role; select public.grant_verified_ar_mascot('{uid}','{attempt}','http-grant');")
        response=client.get('/api/v1/ar/mascots',headers=auth)
        owned=[m for m in response.json()['mascots'] if m['is_owned']]
        if len(owned)!=1 or owned[0]['card_slug']!='straiky' or owned[0]['status']!='owned': raise CheckFailure('AR persistent ownership HTTP mismatch')
        if client.get('/api/v1/cards',headers=auth).json()['points_balance']!=0: raise CheckFailure('AR changed balance')
        print('PASS: local Auth/HTTP AR inventory before/after trusted grant and 4 forbidden browser routes',flush=True)
    finally:
        for field,value in zip(fields,previous): setattr(settings,field,value)
        logging.getLogger('httpx').setLevel(log_level)


def checks(project):
    phase02a_checks(project)
    ar_checks(project)


if __name__=='__main__': sys.exit(main(extra_checks=checks))
