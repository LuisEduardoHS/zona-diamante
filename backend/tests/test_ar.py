import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.main import app
from app.schemas.auth import CurrentUser
from app.services import ar

client = TestClient(app)
USER = '50000000-0000-4000-8000-000000000001'


@pytest.fixture(autouse=True)
def identity():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER)
    yield
    app.dependency_overrides.clear()


def test_inventory_requires_auth():
    app.dependency_overrides.clear()
    assert client.get('/api/v1/ar/mascots').status_code == 401


@pytest.mark.parametrize('owned', [True, False])
def test_inventory_is_owned_scoped_and_claimable(monkeypatch, owned):
    calls = []
    async def request(method, path, **kwargs):
        calls.append((method,path,kwargs))
        return {'teams':[{'id':1,'slug':'charros-jal','name':'Charros'}],
                'cards':[{'id':7,'team_id':1,'slug':'straiky','name':'Straiky'}],
                'user_cards':[{'card_id':7}] if owned else []}[path]
    monkeypatch.setattr(ar,'supabase_rest_request',request)
    response = client.get('/api/v1/ar/mascots', params={'user_id':'another-user','scanned':True})
    assert response.status_code == 200
    mascot = response.json()['mascots'][0]
    assert mascot['is_owned'] is owned
    assert mascot['status'] == ('owned' if owned else 'claimable')
    assert mascot['browser_claim_enabled'] is True
    assert calls[-1][2]['params']['user_id'] == f'eq.{USER}'
    assert calls[1][2]['params']['card_type'] == 'eq.mascot'
    assert calls[1][2]['params']['cost'] == 'eq.0'
    assert all(c[0] == 'GET' for c in calls)


@pytest.mark.parametrize('route',['verify','unlock','authorize'])
def test_no_browser_grant_route(route):
    assert client.post('/api/v1/ar/'+route,json={'scanned':True,'team_id':1,'card_id':7,'points':100}).status_code == 404


def test_inventory_errors_are_safe(monkeypatch):
    async def request(*args,**kwargs):
        raise SupabaseRestError(400,'sensitive internal database details')
    monkeypatch.setattr(ar,'supabase_rest_request',request)
    response = client.get('/api/v1/ar/mascots')
    assert response.status_code == 502
    assert 'sensitive' not in response.text


def test_ambiguous_catalog_fails_closed(monkeypatch):
    async def request(method,path,**kwargs):
        return {'teams':[{'id':1,'slug':'x','name':'Team'}],
                'cards':[{'id':1,'team_id':1,'slug':'one','name':'One'},
                         {'id':2,'team_id':1,'slug':'two','name':'Two'}], 'user_cards':[]}[path]
    monkeypatch.setattr(ar,'supabase_rest_request',request)
    assert client.get('/api/v1/ar/mascots').status_code == 502


def claim_provider(monkeypatch, owned=False, failure=None):
    calls = []
    async def request(method, path, **kwargs):
        calls.append((method, path, kwargs))
        if path == 'rpc/authorize_ar_mascot':
            return '50000000-0000-4000-8000-000000000002'
        if path == 'rpc/grant_verified_ar_mascot':
            if failure:
                raise SupabaseRestError(500, 'sensitive internal grant error')
            return {'card_id': 7, 'already_owned': False, 'already_processed': False}
        return {'teams': [{'id': 1, 'slug': 'charros-jal', 'name': 'Charros'}],
                'cards': [{'id': 7, 'team_id': 1, 'slug': 'straiky', 'name': 'Straiky'}],
                'user_cards': [{'card_id': 7}] if owned else []}[path]
    monkeypatch.setattr(ar, 'supabase_rest_request', request)
    return calls


def test_claim_requires_authentication(monkeypatch):
    calls = claim_provider(monkeypatch)
    app.dependency_overrides.clear()
    assert client.post('/api/v1/ar/claim', json={'team_slug': 'charros-jal'}).status_code == 401
    assert calls == []


def test_claim_resolves_catalog_card_and_uses_server_identity_and_stable_keys(monkeypatch):
    calls = claim_provider(monkeypatch)
    first = client.post('/api/v1/ar/claim', json={'team_slug': 'charros-jal'})
    second = client.post('/api/v1/ar/claim', json={'team_slug': 'charros-jal'})
    assert first.status_code == second.status_code == 200
    assert first.json()['mascot']['is_owned'] and first.json()['mascot']['card_id'] == 7
    assert first.json()['mascot']['status'] == 'owned'
    assert calls[:5] == calls[5:]
    authorizer, grant = calls[3:5]
    assert authorizer[2]['json']['p_user_id'] == USER
    assert authorizer[2]['json']['p_team_slug'] == 'charros-jal'
    assert grant[2]['json']['p_user_id'] == USER
    assert grant[2]['json']['p_attempt_id'].endswith('0002')
    assert authorizer[2]['json']['p_verification_ref'] == grant[2]['json']['p_request_key']
    assert 'ar-self-service:v1:' in grant[2]['json']['p_request_key']
    assert 'card_id' not in grant[2]['json'] and 'points' not in grant[2]['json']


def test_owned_card_is_not_granted_twice(monkeypatch):
    calls = claim_provider(monkeypatch, owned=True)
    response = client.post('/api/v1/ar/claim', json={'team_slug': 'charros-jal'})
    assert response.status_code == 200 and response.json()['already_owned']
    assert response.json()['mascot']['is_owned']
    assert len(calls) == 3 and all(call[0] == 'GET' for call in calls)


@pytest.mark.parametrize('body', [{'team_slug': 'unknown'}, {'team_slug': 'charros-jal', 'card_id': 8},
    {'team_slug': 'charros-jal', 'user_id': 'another'}, {'team_slug': 'charros-jal', 'points': 100},
    {'team_slug': 'charros-jal', 'scanned': True}, {}])
def test_claim_rejects_client_reward_or_identity_fields(monkeypatch, body):
    calls = claim_provider(monkeypatch)
    assert client.post('/api/v1/ar/claim', json=body).status_code == 422
    assert not calls


def test_missing_mascot_and_grant_failure_never_confirm_ownership(monkeypatch):
    claim_provider(monkeypatch)
    assert client.post('/api/v1/ar/claim', json={'team_slug': 'dorados-chi'}).status_code == 404
    calls = claim_provider(monkeypatch, failure=True)
    response = client.post('/api/v1/ar/claim', json={'team_slug': 'charros-jal'})
    assert response.status_code == 502 and 'sensitive' not in response.text
    key = calls[-1][2]['json']['p_request_key']
    calls = claim_provider(monkeypatch)
    assert client.post('/api/v1/ar/claim', json={'team_slug': 'charros-jal'}).status_code == 200
    assert calls[-1][2]['json']['p_request_key'] == key
