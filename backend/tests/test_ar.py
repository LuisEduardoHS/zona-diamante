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
def test_inventory_is_owned_scoped_and_never_claimable(monkeypatch, owned):
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
    assert mascot['status'] == ('owned' if owned else 'verification_required')
    assert mascot['browser_claim_enabled'] is False
    assert calls[-1][2]['params']['user_id'] == f'eq.{USER}'
    assert calls[1][2]['params']['card_type'] == 'eq.mascot'
    assert calls[1][2]['params']['cost'] == 'eq.0'
    assert all(c[0] == 'GET' for c in calls)


@pytest.mark.parametrize('route',['claim','verify','unlock','authorize'])
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
