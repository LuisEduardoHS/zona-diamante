from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import get_current_user
from app.schemas.auth import CurrentUser
from app.db.supabase import SupabaseRestError
from app.services import game_beta

client=TestClient(app)
USER='30000000-0000-4000-8000-000000000050'
GAME='40000000-0000-4000-8000-000000000050'
PITCH='50000000-0000-4000-8000-000000000050'
BASE='/api/v1/games/beta'


def snapshot():
    return dict(id=GAME,version='beta-1',mode='classic',phase='waiting',revision=0,
        rules=game_beta.RULES,expires_at=480000,server_now=0,next_at=0,probe=PITCH,samples=[],compensation_ms=0,
        stats=dict(resolved=0,hits=0,misses=0,perfects=0,score=0,streak=0,bestStreak=0,swings=0),
        reward={'status':'pending'},points_balance=0,rewarded_today=0,daily_limit=3,ops={'secret':'never returned'})


@pytest.fixture
def requests(monkeypatch):
    calls=[]
    async def request(*args,**kwargs):
        calls.append((args,kwargs));return snapshot()
    app.dependency_overrides[get_current_user]=lambda:CurrentUser(id=USER)
    monkeypatch.setattr(game_beta,'supabase_rest_request',request)
    yield calls
    app.dependency_overrides.clear()


@pytest.mark.parametrize('body',[{'mode':'unknown'},{'mode':'classic','score':100},
    {'mode':'classic','win':True},{'mode':'classic','points_delta':999},
    {'mode':'classic','user_id':USER},{'mode':'classic','rules':{}},{}])
def test_start_strict(body,requests):
    assert client.post(BASE,json=body,headers={'Idempotency-Key':'key'}).status_code==422
    assert requests==[]


def test_identity_and_rules_only_from_server(requests):
    result=client.post(BASE,json={'mode':'classic'},headers={'Idempotency-Key':' key '})
    assert result.status_code==200
    body=requests[0][1]['json']
    assert body['p_user_id']==USER and body['p_rules']==game_beta.RULES and body['p_key']=='key'
    assert 'ops' not in result.json()


@pytest.mark.parametrize('body',[{'win':True},{'score':100},{'points':999},{'user_id':USER}])
def test_completion_cannot_claim_result(body,requests):
    assert client.post(BASE+'/'+GAME+'/complete',json=body,headers={'Idempotency-Key':'key'}).status_code==422
    assert requests==[]


@pytest.mark.parametrize('body',[{'expected_revision':True},{'expected_revision':-1},
    {'expected_revision':0,'timestamp':123},{'expected_revision':0,'score':100}])
def test_swing_rejects_client_time_and_result(body,requests):
    assert client.post(BASE+'/'+GAME+'/pitches/'+PITCH+'/swing',json=body,headers={'Idempotency-Key':'key'}).status_code==422
    assert requests==[]


def test_swing_command_and_owner(requests):
    response=client.post(BASE+'/'+GAME+'/pitches/'+PITCH+'/swing',json={'expected_revision':3},headers={'Idempotency-Key':'key'})
    assert response.status_code==200
    body=requests[-1][1]['json']
    assert body['p_action']=='swing' and body['p_revision']==3 and body['p_pitch_id']==PITCH and body['p_user_id']==USER


@pytest.mark.parametrize('detail,code',[('Beta not found.',404),('Beta revision conflict.',409),
    ('Beta already active.',409),('Beta start rate limit.',429),('private SQL detail',502)])
def test_safe_errors(detail,code,requests,monkeypatch):
    async def fail(*a,**k):raise SupabaseRestError(400,detail)
    monkeypatch.setattr(game_beta,'supabase_rest_request',fail)
    response=client.get(BASE+'/'+GAME)
    assert response.status_code==code
    assert 'private SQL detail' not in response.text


def test_public_config_and_authentication():
    assert client.get(BASE+'/config').status_code==200
    assert client.get(BASE+'/current').status_code==401
    assert client.get(BASE+'/'+GAME).status_code==401
    assert client.post(BASE,json={'mode':'classic'},headers={'Idempotency-Key':'key'}).status_code==401


@pytest.mark.parametrize('key',[None,'',' ','x'*129])
def test_key_required_and_bounded(key,requests):
    headers={} if key is None else {'Idempotency-Key':key}
    assert client.post(BASE,json={'mode':'classic'},headers=headers).status_code==422
    assert requests==[]
