import asyncio
import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.main import app
from app.schemas.auth import CurrentUser
from app.services import feedback as mail

client = TestClient(app)
USER, JOB, REQUEST = str(uuid4()), str(uuid4()), str(uuid4())


def payload(**values):
    return {'request_id': REQUEST, 'reason': 'suggestion', 'contact': '', 'message': 'Una sugerencia para la página.', **values}


def job(**values):
    return {'id': JOB, 'reason': 'suggestion', 'contact': '', 'message': 'Mensaje de prueba',
        'sender_email': 'reporter@zona-diamante.dev', 'sender_name': 'Aficionado',
        'recipient_email': 'eduardohdz2111@gmail.com', 'created_at': '2026-11-11T12:00:00Z', **values}


@pytest.fixture(autouse=True)
def configure(monkeypatch):
    monkeypatch.setattr(mail.settings, 'supabase_url', 'https://project.supabase.co')
    monkeypatch.setattr(mail.settings, 'email_dispatch_secret', SecretStr('a' * 40))
    monkeypatch.setattr(mail.settings, 'email_from_address', 'avisos@zona-diamante.dev')
    monkeypatch.setattr(mail.settings, 'feedback_recipient_email', 'eduardohdz2111@gmail.com')
    yield
    app.dependency_overrides.clear()


def login():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER, email='reporter@zona-diamante.dev')


def test_only_authenticated_users_can_submit_or_trigger_dispatch():
    assert client.post('/api/v1/help/feedback', json=payload()).status_code == 401
    assert client.post('/api/v1/internal/help-feedback/dispatch').status_code == 401
    assert client.post('/api/v1/internal/help-feedback/dispatch', headers={'Authorization': 'Bearer user-token'}).status_code == 401


@pytest.mark.parametrize('changes', [
    {'user_id': str(uuid4())}, {'recipient_email': 'attacker@example.com'}, {'sender_email': 'forged@example.com'},
    {'reason': 'other'}, {'request_id': 'invalid'}, {'message': ' ' * 15},
    {'message': 'x' * 4001}, {'contact': 'x' * 201},
])
def test_rejects_invalid_content_and_client_controlled_identity_or_recipient(changes):
    login()
    assert client.post('/api/v1/help/feedback', json=payload(**changes)).status_code == 422


def test_persists_before_background_delivery_and_binds_identity_and_recipient(monkeypatch):
    login(); calls = []
    async def rpc(method, path, **kwargs):
        calls.append(('persist', kwargs['json']))
        return {'id': JOB, 'status': 'received'}
    async def deliver(id):
        assert len(calls) == 1
        calls.append(('deliver', id))
    monkeypatch.setattr(mail, 'supabase_rest_request', rpc)
    monkeypatch.setattr(mail, 'deliver_in_background', deliver)
    r = client.post('/api/v1/help/feedback', json=payload(message='  Un mensaje nuevo para Ayuda.  '))
    assert r.status_code == 202 and r.json() == {'id': JOB, 'status': 'received'}
    assert calls[0][1] == {'p_user_id': USER, 'p_request_id': REQUEST, 'p_reason': 'suggestion',
        'p_contact': '', 'p_message': 'Un mensaje nuevo para Ayuda.', 'p_recipient': 'eduardohdz2111@gmail.com'}
    assert calls[1] == ('deliver', JOB)


@pytest.mark.parametrize('detail,status', [
    ('Feedback rate limit exceeded.', 429), ('Feedback request conflict.', 409),
    ('Verified account required.', 403), ('private database details', 503),
])
def test_failed_persistence_never_reports_success_or_schedules_email(monkeypatch, detail, status):
    login()
    async def fail(*args, **kwargs):
        raise SupabaseRestError(400, detail)
    async def forbidden(*args):
        pytest.fail('No email without successful persistence')
    monkeypatch.setattr(mail, 'supabase_rest_request', fail)
    monkeypatch.setattr(mail, 'deliver_in_background', forbidden)
    response = client.post('/api/v1/help/feedback', json=payload())
    assert response.status_code == status
    assert 'private database details' not in response.text


def test_missing_configuration_does_not_accept_messages(monkeypatch):
    login(); monkeypatch.setattr(mail.settings, 'email_dispatch_secret', SecretStr(''))
    assert client.post('/api/v1/help/feedback', json=payload()).status_code == 503


@pytest.mark.parametrize('status,data,success', [
    (200, {'accepted':1,'failed':0}, True), (503, {'error':'not_configured'}, False),
    (200, {'accepted':'1','failed':0}, False), (200, {}, False),
])
def test_edge_contract_sends_only_id_and_job_secret(monkeypatch,status,data,success):
    original=httpx.AsyncClient
    def transport(request):
        assert str(request.url)=='https://project.supabase.co/functions/v1/help-feedback-email'
        assert request.headers['X-Feedback-Secret']=='a'*40
        assert json.loads(request.content)=={'id':JOB}
        return httpx.Response(status,json=data)
    monkeypatch.setattr(mail.httpx,'AsyncClient',lambda **kwargs:original(transport=httpx.MockTransport(transport),**kwargs))
    if success:
        assert asyncio.run(mail.dispatch(JOB))==data
    else:
        with pytest.raises(RuntimeError,match='temporarily unavailable'):
            asyncio.run(mail.dispatch(JOB))


def test_edge_timeout_does_not_claim_or_resend_a_job_locally(monkeypatch):
    original=httpx.AsyncClient
    def transport(request):
        raise httpx.ReadTimeout('timeout',request=request)
    monkeypatch.setattr(mail.httpx,'AsyncClient',lambda **kwargs:original(transport=httpx.MockTransport(transport),**kwargs))
    with pytest.raises(RuntimeError):
        asyncio.run(mail.dispatch(JOB))


def test_background_failure_keeps_saved_message_without_logging_content(monkeypatch,caplog):
    async def fail(*args):
        raise RuntimeError('private message or provider token')
    monkeypatch.setattr(mail,'dispatch',fail)
    asyncio.run(mail.deliver_in_background(JOB))
    assert JOB in caplog.text and 'private message' not in caplog.text
