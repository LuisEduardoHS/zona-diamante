import asyncio
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.security import get_current_user
from app.main import app
from app.schemas.auth import CurrentUser
from app.services import trivia_email as mail
from app.api.routes import email_notifications as routes

client = TestClient(app)
USER, JOB, TOKEN = str(uuid4()), str(uuid4()), str(uuid4())


def fixture_job(**values):
    return {'id': JOB, 'recipient_email': 'test@qa.zona-diamante.dev', 'recipient_name': 'Luis',
            'unsubscribe_token': TOKEN, 'question_count': 5, 'points_per_correct': 20, **values}


@pytest.fixture(autouse=True)
def config(monkeypatch):
    monkeypatch.setattr(mail.settings, 'trivia_email_enabled', False)
    monkeypatch.setattr(mail.settings, 'brevo_api_key', SecretStr('test-provider-key'))
    monkeypatch.setattr(mail.settings, 'email_dispatch_secret', SecretStr('a' * 40))
    monkeypatch.setattr(mail.settings, 'email_from_address', 'sender@example.invalid')
    yield
    app.dependency_overrides.clear()


def test_disabled_dispatch_has_no_db_or_provider_side_effects(monkeypatch):
    async def forbidden(*args, **kwargs):
        pytest.fail('Disabled dispatch must not access DB/provider')
    monkeypatch.setattr(mail, 'supabase_rest_request', forbidden)
    assert asyncio.run(mail.dispatch()) == {'enabled': False, 'queued': 0, 'sent': 0, 'failed': 0}


@pytest.mark.parametrize('secret', ['', 'wrong', 'a' * 39, 'á' * 40])
def test_dispatch_rejects_public_requests_and_regular_user_tokens(secret):
    response = client.post('/api/v1/internal/trivia-email/dispatch', headers={'X-Cron-Secret': secret.encode('utf-8').hex()})
    assert response.status_code == 401


def test_valid_job_secret_obeys_disabled_switch():
    r = client.post('/api/v1/internal/trivia-email/dispatch', headers={'X-Cron-Secret': 'a' * 40})
    assert r.status_code == 200 and r.json()['enabled'] is False


def test_preferences_require_login():
    assert client.get('/api/v1/email/preferences').status_code == 401


def test_preferences_bind_user_from_jwt_and_reject_identity_in_body(monkeypatch):
    calls = []
    async def rpc(*args, **kwargs):
        calls.append(kwargs['json']); return False
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER)
    monkeypatch.setattr(mail, 'supabase_rest_request', rpc)
    r = client.patch('/api/v1/email/preferences', json={'trivia_email_enabled': False})
    assert r.status_code == 200 and r.json() == {'trivia_email_enabled': False}
    assert calls == [{'p_user_id': USER, 'p_enabled': False}]
    for body in [{'trivia_email_enabled': 'false'}, {'trivia_email_enabled': True, 'user_id': str(uuid4())},
        {'trivia_email_enabled': True, 'consented_at': '2026-11-10T12:00:00Z'},
        {'trivia_email_enabled': True, 'consent_source': 'profile'}]:
        assert client.patch('/api/v1/email/preferences', json=body).status_code == 422


def test_reading_preference_does_not_opt_in(monkeypatch):
    calls=[]
    async def rpc(*args, **kwargs):
        calls.append(kwargs['json']);return False
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER)
    monkeypatch.setattr(mail, 'supabase_rest_request', rpc)
    response=client.get('/api/v1/email/preferences')
    assert response.status_code==200 and response.json()=={'trivia_email_enabled':False}
    assert calls==[{'p_user_id':USER,'p_enabled':None}]


def test_unsubscribe_get_is_read_only_and_post_works_without_session(monkeypatch):
    calls = []
    async def rpc(*args, **kwargs):
        calls.append((args, kwargs))
    monkeypatch.setattr(routes, 'supabase_rest_request', rpc)
    r = client.get('/api/v1/email/trivia/unsubscribe/' + TOKEN)
    assert r.status_code == 200 and not calls and 'method="post"' in r.text
    assert r.headers['referrer-policy'] == 'no-referrer' and r.headers['cache-control'] == 'no-store'
    r = client.post('/api/v1/email/trivia/unsubscribe/' + TOKEN)
    assert r.status_code == 200 and 'Avisos desactivados' in r.text
    assert calls[0][1]['json'] == {'p_token': TOKEN}


def test_personalized_template_escapes_names_has_real_reward_and_no_images():
    notice = mail.render_notice(fixture_job(recipient_name='<script>alert("x")</script>'))
    assert '<script>' not in notice['html'] and '&lt;script&gt;' in notice['html']
    assert '100 puntos' in notice['text'] and '5 preguntas' in notice['text']
    assert 'trivia.html' in notice['html'] and TOKEN in notice['html']
    assert '<img' not in notice['html']
    assert 'display:none' not in notice['html']
    assert notice['subject']=='Zona Diamante: nueva trivia disponible'
    assert 'activaste los avisos de trivia en tu perfil' in notice['text']
    assert 'activaste los avisos de trivia en tu perfil' in notice['html']


def test_missing_provider_and_sender_are_configuration_errors(monkeypatch):
    monkeypatch.setattr(mail.settings, 'email_from_address', '')
    monkeypatch.setattr(mail.settings, 'brevo_api_key', SecretStr(''))
    assert {'BREVO_API_KEY', 'EMAIL_FROM_ADDRESS'} <= set(mail.configuration_errors())


@pytest.mark.parametrize('status,data,expected', [
    (201, {'messageId': '<accepted@example.invalid>'}, 'accepted'),
    (400, {'code': 'duplicate_parameter', 'message': 'Email for the idempotency key has already been processed'}, 'accepted'),
    (400, {'code': 'invalid_parameter'}, 'permanent'),
    (429, {}, 'retry_unsent'), (401, {}, 'retry_unsent'), (503, {}, 'retry_unknown'),
])
def test_provider_contract_and_individual_recipients(status, data, expected):
    sent = []
    def transport(request):
        sent.append(request)
        return httpx.Response(status, json=data)
    async def send():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as provider:
            if expected == 'accepted':
                await mail.send_notice(provider, fixture_job())
            else:
                with pytest.raises(mail.DeliveryError) as caught:
                    await mail.send_notice(provider, fixture_job())
                assert caught.value.retry == expected.startswith('retry')
                assert caught.value.definitely_unsent == (expected == 'retry_unsent')
    asyncio.run(send())
    import json
    payload = json.loads(sent[0].content)
    assert payload['headers'] == {'idempotencyKey': JOB}
    assert len(payload['to']) == 1 and 'cc' not in payload and 'bcc' not in payload
    assert payload['textContent'] == mail.render_notice(fixture_job())['text']


@pytest.mark.parametrize('address', ['qa@zona-diamante.invalid', 'qa@EXAMPLE.INVALID',
    'qa@sub.example.com', 'qa@example.net', 'qa@localhost', 'qa@demo.test', 'qa@demo.invalid.',
    'not-an-email', 'victim@gmail.com\r\nBcc:other@gmail.com'])
def test_reserved_or_invalid_recipient_never_reaches_provider(address):
    def transport(request):
        pytest.fail('Reserved/invalid address reached provider')
    async def send():
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as provider:
            with pytest.raises(mail.DeliveryError) as error:
                await mail.send_notice(provider, fixture_job(recipient_email=address))
            assert not error.value.retry and error.value.definitely_unsent
    asyncio.run(send())


@pytest.mark.parametrize('address', ['name@gmail.com', 'name+alias@outlook.com', 'name@sub.business.mx'])
def test_public_recipient_accepts_normal_addresses(address):
    assert mail.public_recipient(address)


def test_dispatch_stops_on_outage_and_records_retriable_job(monkeypatch):
    monkeypatch.setattr(mail.settings, 'trivia_email_enabled', True)
    calls = []
    async def trivia(*args): return {'daily_trivia_id': 'current-trivia'}
    async def verify(*args): pass
    async def send(*args): raise mail.DeliveryError('provider_unreachable', retry=True)
    async def rpc(method, path, **kwargs):
        calls.append((path, kwargs['json']))
        if path.endswith('prepare_trivia_emails'): return 10
        if path.endswith('claim_trivia_email'): return fixture_job(lease_token=str(uuid4()))
        if path.endswith('finish_trivia_email'): return True
        pytest.fail(path)
    monkeypatch.setattr(mail, 'get_or_create_daily_trivia', trivia)
    monkeypatch.setattr(mail, 'verify_sender', verify)
    monkeypatch.setattr(mail, 'send_notice', send)
    monkeypatch.setattr(mail, 'supabase_rest_request', rpc)
    result = asyncio.run(mail.dispatch())
    assert result['sent'] == 0 and result['failed'] == 1
    assert len(calls) == 3 and calls[-1][1]['p_status'] == 'retry'
    assert calls[-1][1]['p_definitely_unsent'] is False
