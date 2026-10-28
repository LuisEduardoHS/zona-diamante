"""Owned disposable Auth/DB/FastAPI for browser QA. STOP cleans only this stack."""
import argparse
import json
import shutil
import socket
import sys
import threading
import time
from pathlib import Path
from uuid import uuid4

import httpx
import uvicorn

sys.path.insert(0,str(Path(__file__).parents[1]))
from phase01_database import ROOT, LocalProject, CheckFailure


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--evidence',default='.tmp/phase04-live/evidence');args=parser.parse_args()
    evidence=(ROOT/args.evidence).resolve()
    if not evidence.is_relative_to(ROOT.resolve()):raise CheckFailure('Evidence must remain in the workspace')
    folder=ROOT/'.tmp/phase04-live';folder.mkdir(parents=True,exist_ok=True)
    stop=folder/'STOP'
    if stop.exists():stop.unlink()
    project=LocalProject('clean',str(ROOT/'node_modules/.bin/supabase.cmd'));server=None
    try:
        for file in (ROOT/'supabase/migrations').glob('*.sql'):
            shutil.copyfile(file,project.supabase/'migrations'/file.name)
        shutil.copyfile(ROOT/'supabase/seed.sql',project.supabase/'seed.sql')
        project.start()
        local=json.loads(project.run_cli('status','--output','json'))
        api=local['API_URL']
        if not api.startswith('http://127.0.0.1:'):raise CheckFailure('Local stack required')
        tag=uuid4().hex;email=f'beta-browser-{tag}@example.invalid';password=uuid4().hex
        response=httpx.post(api+'/auth/v1/signup',headers={'apikey':local['ANON_KEY']},
            json={'email':email,'password':password,'data':{'username':'beta_browser_'+tag}},timeout=15)
        response.raise_for_status();uid=response.json()['user']['id']
        cost=int(project.sql("select cost from public.cards where slug='sultanes-de-monterrey';"));fund=cost-60
        project.sql(f"update public.profiles set points_balance={fund} where id='{uid}';insert into public.reward_events(user_id,event_type,points_delta,idempotency_key) values('{uid}','test_funding',{fund},'beta-browser-fund');")
        from app.core.config import settings
        settings.supabase_url=api;settings.supabase_publishable_key=local['ANON_KEY'];settings.supabase_secret_key=local['SERVICE_ROLE_KEY']
        settings.frontend_origins='http://127.0.0.1:4211'
        from app.main import app
        with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        server=uvicorn.Server(uvicorn.Config(app,host='127.0.0.1',port=port,log_level='warning'))
        threading.Thread(target=server.run,daemon=True).start()
        while not server.started:time.sleep(.1)
        (folder/'manifest.json').write_text(json.dumps({'SUPABASE_URL':api,'SUPABASE_PUBLISHABLE_KEY':local['ANON_KEY'],
            'BACKEND_API_URL':f'http://127.0.0.1:{port}','email':email,'password':password,'project':project.project_id}),encoding='utf-8')
        print('READY: owned local Auth/DB/FastAPI. Browser preview 4211; synthetic balance is card cost minus 60.',flush=True)
        while not stop.exists():time.sleep(.5)
        state=project.value(f"select jsonb_build_object('balance',points_balance,'funding',{fund},'cards',(select count(*) from public.user_cards where user_id=p.id),'game_events',(select count(*) from public.reward_events where user_id=p.id and event_type='game_beta_completion'),'game_points',(select coalesce(sum(points_delta),0) from public.reward_events where user_id=p.id and event_type='game_beta_completion'),'purchases',(select count(*) from public.reward_events where user_id=p.id and event_type='card_purchase'),'ledger',(select sum(points_delta) from public.reward_events where user_id=p.id)) from public.profiles p where id='{uid}'")
        evidence.mkdir(parents=True,exist_ok=True)
        (evidence/'browser-db-final.json').write_text(json.dumps(state,indent=2),encoding='utf-8')
        print('Browser DB final: '+json.dumps(state),flush=True)
        if state['balance']!=state['ledger']:raise CheckFailure('Browser ledger did not reconcile')
    finally:
        if server:server.should_exit=True
        project.stop()


if __name__=='__main__':main()
