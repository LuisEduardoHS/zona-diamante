from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.main import app
from app.schemas.auth import CurrentUser
from app.services import game_buffered
from tests.test_game_beta import snapshot, USER, GAME

BASE = '/api/v1/games/buffered'
client = TestClient(app)


@pytest.fixture
def calls(monkeypatch):
    requests = []
    async def request(*args, **kwargs):
        requests.append((args, kwargs))
        return {**snapshot(), 'transport': 'buffered-1', 'version': 'survival-1', 'mode': 'survival'}
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER)
    monkeypatch.setattr(game_buffered, 'supabase_rest_request', request)
    yield requests
    app.dependency_overrides.clear()


def test_reservation_needs_one_authenticated_command_and_server_rules(calls):
    response = client.post(BASE, json={}, headers={'Idempotency-Key': 'stable-start'})
    assert response.status_code == 200
    assert len(calls) == 1 and calls[0][0] == ('POST', 'rpc/game_buffered_command')
    body = calls[0][1]['json']
    assert body['p_user_id'] == USER and body['p_rules'] == game_buffered.RULES
    assert body['p_key'] == 'stable-start'
    assert response.json()['transport'] == 'buffered-1' and 'ops' not in response.json()


@pytest.mark.parametrize('body', [{'score': 20}, {'points': 999}, {'rules': {}}, {'user_id': USER}, {'mode': 'classic'}])
def test_reservation_cannot_choose_identity_economy_or_rules(calls, body):
    assert client.post(BASE, json=body, headers={'Idempotency-Key': 'start'}).status_code == 422
    assert calls == []


def test_completion_only_forwards_the_recorded_inputs(calls):
    events = [{'pitch': i, 'at_ms': None if i == 3 else 1200.0} for i in range(1, 4)]
    response = client.post(f'{BASE}/{GAME}/complete', json={'events': events})
    assert response.status_code == 200
    body = calls[0][1]['json']
    assert body['p_events'] == events and body['p_attempt_id'] == GAME and body['p_user_id'] == USER
    assert body['p_action'] == 'complete' and 'p_rules' not in body


@pytest.mark.parametrize('body', [
    {'events': []}, {'events': [{'pitch': 1, 'at_ms': 0}] * 10001},
    {'events': [{'pitch': True, 'at_ms': 0}] * 3}, {'events': [{'pitch': 1, 'at_ms': -1}] * 3},
    {'events': [{'pitch': 1, 'at_ms': '1200'}] * 3},
    {'events': [{'pitch': 1, 'at_ms': 0, 'hit': True}] * 3},
    {'events': [{'pitch': 1, 'at_ms': 0}] * 3, 'points': 100},
    {'events': [{'pitch': 1, 'at_ms': 0}] * 3, 'score': 100},
    {'events': [{'pitch': 1, 'at_ms': 0}] * 3, 'user_id': str(uuid4())},
])
def test_malformed_or_claimed_results_never_reach_the_database(calls, body):
    assert client.post(f'{BASE}/{GAME}/complete', json=body).status_code == 422
    assert calls == []


@pytest.mark.parametrize('detail,status', [('Invalid buffered inputs.', 422),
    ('Incomplete buffered game.', 422), ('Buffered duration not reached.', 409),
    ('Beta not found.', 404), ('Beta key conflict.', 409), ('private details', 502)])
def test_buffered_errors_are_bounded_and_safe(calls, monkeypatch, detail, status):
    async def fail(*args, **kwargs):
        raise SupabaseRestError(400, detail)
    monkeypatch.setattr(game_buffered, 'supabase_rest_request', fail)
    response = client.get(f'{BASE}/{GAME}')
    assert response.status_code == status and 'private details' not in response.text


def test_all_buffered_operations_require_authentication():
    assert client.post(BASE, json={}, headers={'Idempotency-Key': 'start'}).status_code == 401
    assert client.get(f'{BASE}/{GAME}').status_code == 401
    assert client.post(f'{BASE}/{GAME}/complete', json={'events': [{'pitch': i, 'at_ms': None} for i in range(1, 4)]}).status_code == 401
