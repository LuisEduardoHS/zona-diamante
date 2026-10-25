"""Phase 1 acceptance plus game races; only generated, unlinked local projects.

Run from the repository root with the existing backend Python. No new driver,
dependency installation, remote DSN or service credential is needed.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json
import logging
import sys
from urllib.parse import urlparse
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent))
from phase01_database import CheckFailure, fixture_user, main, race, user


def start(n, key, parent=None):
    parent_arg = f"'{parent}'" if parent else "null"
    return f"select public.start_game_attempt('{user(n)}','{key}',{parent_arg})"


def change(n, game, action, revision):
    return f"select public.transition_game_attempt('{user(n)}','{game}','{action}',{revision})"


def expect_errors(results, message):
    failed = [r for r in results if r.returncode]
    if not failed or any(message not in r.stderr for r in failed):
        raise CheckFailure("Unexpected game concurrency failure")


def game_concurrency(project):
    for n in range(20, 26):
        fixture_user(project, n, 0)

    _, rows = race(project, start(20, 'same'), start(20, 'same'), 2)
    if rows[0]['id'] != rows[1]['id']:
        raise CheckFailure("Duplicate concurrent start created two sessions")
    game = rows[0]['id']
    _, rows = race(project, change(20, game, 'pause', 0), change(20, game, 'pause', 0), 2)
    if any(r['game_revision'] != 1 or r['game_state'] != 'paused' for r in rows):
        raise CheckFailure("Duplicate concurrent pause did not converge")

    game = project.value(start(21, 'new') + ';')['id']
    results, _ = race(project, change(21, game, 'pause', 0), change(21, game, 'abandon', 0), 1)
    expect_errors(results, 'Game transition conflict.')

    game = project.value(start(22, 'new') + ';')['id']
    _, rows = race(project, start(22, 'restart', game), start(22, 'restart', game), 2)
    if rows[0]['id'] != rows[1]['id'] or rows[0]['id'] == game:
        raise CheckFailure("Duplicate concurrent restart created extra successors")

    game = project.value(start(23, 'new') + ';')['id']
    results, _ = race(project, start(23, 'one', game), start(23, 'two', game), 1)
    expect_errors(results, 'Game already restarted.')

    game = project.value(start(24, 'new') + ';')['id']
    _, rows = race(project, start(24, 'restart', game), change(24, game, 'abandon', 0), 2)
    state = project.value(f"select to_jsonb(a) from public.activity_attempts a where id='{game}';")
    if state['game_state'] != 'abandoned' or state['game_revision'] != 1:
        raise CheckFailure("Restart versus abandon did not converge")

    # Failed economic completion overlaps a valid pause. No partial credit/event.
    game = project.value(start(25, 'new') + ';')['id']
    claim = f"select public.complete_activity_attempt('{user(25)}','{game}','game_win','forged',100,1000)"
    results, _ = race(project, claim, change(25, game, 'pause', 0), 1)
    expect_errors(results, 'managed_game_shape')

    state = project.value("""select jsonb_build_object(
        'balance', (select sum(points_balance) from public.profiles where id in
            (select ('30000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(20,25) n)),
        'rewards', (select count(*) from public.reward_events e join public.activity_attempts a on a.id=e.attempt_id where a.game_state is not null),
        'inventory', (select count(*) from public.user_cards where user_id in
            (select ('30000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(20,25) n)),
        'children', (select count(*) from public.activity_attempts where game_parent_id is not null)
    );""")
    if state != dict(balance=0, rewards=0, inventory=0, children=3):
        raise CheckFailure(f"Game race state mismatch: {state}")
    print("PASS: 7 real concurrent game scenarios; zero credit/rewards/inventory", flush=True)


def http_checks(project):
    """Real local Auth + PostgREST + PostgreSQL, with FastAPI through ASGI.

    CLI secrets stay in memory; neither credentials nor response bodies are
    printed. Identity dependencies are NOT overridden in this integration test.
    """
    import httpx
    from fastapi.testclient import TestClient

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from app.core.config import settings
    from app.main import app

    local = json.loads(project.run_cli('status', '--output', 'json'))
    api = local['API_URL']
    if urlparse(api).hostname not in ('127.0.0.1', 'localhost') or urlparse(api).scheme != 'http':
        raise CheckFailure('Refusing non-local HTTP integration target')
    fields = ('supabase_url', 'supabase_publishable_key', 'supabase_secret_key')
    previous = tuple(getattr(settings, field) for field in fields)
    old_http_log = logging.getLogger('httpx').level
    logging.getLogger('httpx').setLevel(logging.ERROR)
    count = 0

    def check(condition):
        nonlocal count
        count += 1
        if not condition:
            raise CheckFailure(f'Local Auth/FastAPI/PostgREST check {count} failed; response suppressed')

    try:
        settings.supabase_url = api
        settings.supabase_publishable_key = local['ANON_KEY']
        settings.supabase_secret_key = local['SERVICE_ROLE_KEY']
        client = TestClient(app)
        check(client.post('/api/v1/games', json={}, headers={'Idempotency-Key': 'http'}).status_code == 401)
        check(client.get('/api/v1/games/' + str(uuid4()), headers={'Authorization': 'Bearer invalid'}).status_code == 401)
        accounts = []
        for _ in range(2):
            tag = uuid4().hex
            response = httpx.post(api + '/auth/v1/signup', headers={'apikey': local['ANON_KEY']},
                json={'email': f'game-http-{tag}@example.invalid', 'password': uuid4().hex,
                      'data': {'username': 'game_http_' + tag}}, timeout=10)
            check(response.status_code == 200)
            data = response.json()
            check(bool(data.get('access_token')))
            accounts.append((data['user']['id'], {'Authorization': 'Bearer ' + data['access_token']}))
        owner, auth = accounts[0]
        _, foreign = accounts[1]
        headers = {**auth, 'Idempotency-Key': 'http-start'}
        response = client.post('/api/v1/games', json={}, headers=headers)
        check(response.status_code == 200)
        game = response.json()['id']
        path = '/api/v1/games/' + game
        check(response.json()['rewards_enabled'] is False)
        check(client.post('/api/v1/games', json={}, headers=headers).json()['id'] == game)
        check(client.get(path, headers=auth).status_code == 200)
        check(client.get(path, headers=foreign).status_code == 404)
        check(client.get('/api/v1/games/' + str(uuid4()), headers=auth).status_code == 404)
        check(client.post(path + '/transitions', json={'action':'pause','expected_revision':0}, headers=foreign).status_code == 404)
        check(client.post('/api/v1/games', json={'restart_of':game}, headers={**foreign,'Idempotency-Key':'foreign'}).status_code == 404)

        def pause():
            with TestClient(app) as concurrent_client:
                return concurrent_client.post(path + '/transitions',
                    json={'action':'pause','expected_revision':0}, headers=auth)
        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(lambda _: pause(), range(2)))
        check(all(r.status_code == 200 and r.json()['game_revision'] == 1 for r in responses))
        check(client.post(path + '/transitions', json={'action':'resume','expected_revision':0}, headers=auth).status_code == 409)
        check(client.post(path + '/transitions', json={'action':'resume','expected_revision':1}, headers=auth).json()['game_revision'] == 2)
        check(client.post(path + '/transitions', json={'action':'win','expected_revision':2,'score':100}, headers=auth).status_code == 422)
        check(client.post(path + '/complete', json={'win':True,'points':1000}, headers=auth).status_code == 404)
        check(client.post('/api/v1/games', json={'user_id':owner,'score':100}, headers=headers).status_code == 422)

        # Generic, browser-controlled metadata is never accepted as managed state.
        generic = client.post('/api/v1/attempts', json={'activity_type':'game',
            'metadata':{'game_state':'active','win':True}}, headers=auth)
        check(generic.status_code == 201)
        check(client.get('/api/v1/games/' + generic.json()['id'], headers=auth).status_code == 404)

        restart_headers = {**auth, 'Idempotency-Key':'http-restart'}
        restarted = client.post('/api/v1/games', json={'restart_of':game}, headers=restart_headers)
        check(restarted.status_code == 200 and restarted.json()['id'] != game)
        successor = restarted.json()['id']
        check(client.post('/api/v1/games', json={'restart_of':game}, headers=restart_headers).json()['id'] == successor)
        check(client.post('/api/v1/games', json={'restart_of':game}, headers={**auth,'Idempotency-Key':'another'}).status_code == 409)
        check(client.get(path, headers=auth).json()['game_state'] == 'abandoned')
        check(client.post(path + '/transitions', json={'action':'resume','expected_revision':3}, headers=auth).status_code == 409)
        successor_path = '/api/v1/games/' + successor
        for _ in range(2):
            check(client.post(successor_path + '/transitions', json={'action':'abandon','expected_revision':0}, headers=auth).json()['game_revision'] == 1)
        check(client.post(successor_path + '/transitions', json={'action':'pause','expected_revision':1}, headers=auth).status_code == 409)
        check(client.get('/api/v1/me', headers=auth).json()['id'] == owner)
        check(client.get('/api/v1/cards', headers=auth).json()['points_balance'] == 0)
        check(client.get('/api/v1/rewards', headers=auth).json() == [])
        check(project.sql(f"select count(*) from public.user_cards where user_id='{owner}';") == '0')
        print(f'PASS: {count} local Auth/FastAPI/PostgREST checks including concurrent HTTP retry', flush=True)
    finally:
        for field, value in zip(fields, previous):
            setattr(settings, field, value)
        logging.getLogger('httpx').setLevel(old_http_log)


def phase02a_checks(project):
    game_concurrency(project)
    http_checks(project)


if __name__ == '__main__':
    sys.exit(main(extra_checks=phase02a_checks))
