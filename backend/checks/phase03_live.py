"""Disposable Supabase + actual FastAPI for collection browser acceptance.

No remote settings/credentials are copied. Creates only a synthetic local user.
Write .tmp/phase03-live/STOP to terminate and clean up the owned containers.
"""
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

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from phase01_database import ROOT, LocalProject, CheckFailure


def main():
    folder = ROOT / '.tmp/phase03-live'
    folder.mkdir(parents=True, exist_ok=True)
    stop = folder / 'STOP'
    if stop.exists():
        stop.unlink()
    cli = ROOT / 'node_modules/.bin/supabase.cmd'
    project = LocalProject('clean', str(cli))
    server = None
    try:
        for path in (ROOT / 'supabase/migrations').glob('*.sql'):
            shutil.copyfile(path, project.supabase / 'migrations' / path.name)
        shutil.copyfile(ROOT / 'supabase/seed.sql', project.supabase / 'seed.sql')
        project.start()
        project.run_cli('db', 'reset', '--local')
        config = json.loads(project.run_cli('status', '--output', 'json'))
        api_url = config['API_URL']
        if not api_url.startswith('http://127.0.0.1:'):
            raise CheckFailure('Local URL required')
        tag = uuid4().hex
        email, password = f'collection-{tag}@example.invalid', uuid4().hex
        account = httpx.post(api_url + '/auth/v1/signup', headers={'apikey':config['ANON_KEY']},
                             json={'email':email, 'password':password, 'data':{'username':'col_'+tag}}, timeout=15)
        account.raise_for_status()
        uid = account.json()['user']['id']
        project.sql(f"update public.profiles set points_balance=1000 where id='{uid}';"
                    f"insert into public.reward_events(user_id,event_type,points_delta,idempotency_key) values ('{uid}','test_funding',1000,'phase03-local-funding');")
        from app.core.config import settings
        settings.supabase_url = api_url
        settings.supabase_publishable_key = config['ANON_KEY']
        settings.supabase_secret_key = config['SERVICE_ROLE_KEY']
        settings.frontend_origins = 'http://127.0.0.1:4181'
        from app.main import app
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0))
            port = sock.getsockname()[1]
        server = uvicorn.Server(uvicorn.Config(app,host='127.0.0.1',port=port,log_level='warning'))
        threading.Thread(target=server.run,daemon=True).start()
        while not server.started:
            time.sleep(.1)
        base = f'http://127.0.0.1:{port}'
        catalog = httpx.get(base+'/api/v1/cards/catalog').json()
        (folder/'manifest.json').write_text(json.dumps({'SUPABASE_URL':api_url,
            'SUPABASE_PUBLISHABLE_KEY':config['ANON_KEY'],'BACKEND_API_URL':base,
            'email':email,'password':password,'project':project.project_id}),encoding='utf-8')
        print(f'READY: local Auth/FastAPI, {catalog["total_cards"]} active cards; manifest .tmp/phase03-live/manifest.json',flush=True)
        while not stop.exists():
            time.sleep(.5)
        state = project.value(f"select jsonb_build_object('balance',points_balance,'cards',(select count(*) from public.user_cards where user_id=p.id),'purchases',(select count(*) from public.reward_events where user_id=p.id and event_type='card_purchase'),'ledger',(select sum(points_delta) from public.reward_events where user_id=p.id)) from public.profiles p where id='{uid}'")
        evidence = ROOT/'docs/evidencias/fase03'
        evidence.mkdir(parents=True,exist_ok=True)
        (evidence/'live-db-final.json').write_text(json.dumps(state,indent=2),encoding='utf-8')
        print('Local browser final state: '+json.dumps(state),flush=True)
        if state['balance'] != state['ledger'] or state['cards'] != state['purchases']:
            raise CheckFailure('Browser purchase did not reconcile with ledger')
        return 0
    finally:
        if server:
            server.should_exit = True
        project.stop()


if __name__ == '__main__':
    sys.exit(main())
