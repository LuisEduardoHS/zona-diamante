"""Individual trivia notices; disabled by default, durable claims, bounded retries."""
import hmac
from email.headerregistry import Address
from email.errors import HeaderParseError
from html import escape
from urllib.parse import urlsplit
from uuid import UUID

import httpx

from app.core.config import settings
from app.db.supabase import supabase_rest_request
from app.services.trivia import get_current_trivia_period, get_or_create_daily_trivia


def configuration_errors() -> list[str]:
    errors = []
    if not settings.brevo_api_key.get_secret_value():
        errors.append('BREVO_API_KEY')
    if len(settings.email_dispatch_secret.get_secret_value()) < 32:
        errors.append('EMAIL_DISPATCH_SECRET (mínimo 32 caracteres)')
    try:
        address = Address(addr_spec=settings.email_from_address)
        if not address.username or not address.domain:
            raise ValueError()
    except (ValueError, IndexError, HeaderParseError):
        errors.append('EMAIL_FROM_ADDRESS')
    for field in ('email_site_url', 'email_api_url'):
        url = urlsplit(getattr(settings, field))
        if url.scheme != 'https' or not url.netloc or url.username or url.query or url.fragment:
            errors.append(field.upper() + ' (URL HTTPS pública)')
    return errors


def authorized_dispatch(secret: str) -> bool:
    expected = settings.email_dispatch_secret.get_secret_value()
    return len(expected) >= 32 and hmac.compare_digest(secret.encode(), expected.encode())


def public_recipient(email: str) -> bool:
    """Reject non-deliverable reserved/test domains before contacting Brevo."""
    try:
        address = Address(addr_spec=email.strip())
        domain = address.domain.lower().rstrip('.')
        if not address.username or '.' not in domain:
            return False
        if domain.split('.')[-1] in {'invalid', 'test', 'example', 'localhost'}:
            return False
        return not any(domain == name or domain.endswith('.' + name)
            for name in ('example.com', 'example.net', 'example.org'))
    except (ValueError, IndexError, AttributeError, HeaderParseError):
        return False


async def preference(user_id: str, enabled: bool | None = None) -> dict:
    value = await supabase_rest_request('POST', 'rpc/trivia_email_preference',
        json={'p_user_id': user_id, 'p_enabled': enabled})
    return {'trivia_email_enabled': value}


def render_notice(job: dict) -> dict:
    """Email-safe table layout, escaped names, no tracking pixels or JS."""
    name = str(job['recipient_name']).strip()[:100] or 'aficionado'
    questions, points = int(job['question_count']), int(job['points_per_correct'])
    play = settings.email_site_url.rstrip('/') + '/pages/experiencias/trivia.html'
    token = UUID(str(job['unsubscribe_token']))
    unsubscribe = settings.email_api_url.rstrip('/') + '/api/v1/email/trivia/unsubscribe/' + str(token)
    subject = 'Zona Diamante: nueva trivia disponible'
    text = (f'Hola, {name}.\n\nPuedes consultar la trivia del periodo actual desde tu cuenta de Zona Diamante. '
            f'Contiene {questions} preguntas. Puntuación máxima: {questions * points} puntos.\n\n'
            f'Consultar trivia: {play}\n\nDisponible hasta el siguiente cambio de turno. '
            'Recibes este aviso porque activaste los avisos de trivia en tu perfil.\n\n'
            f'Desactivar estos avisos: {unsubscribe}\nZona Diamante')
    html = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f4f7f8;color:#2b2b31;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:auto;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="padding:28px;background:#007f90;color:#ffffff;font-weight:bold;font-size:19px">ZONA DIAMANTE</td></tr>
<tr><td style="padding:32px 28px"><p style="margin:0 0 14px;font-size:16px">Hola, {escape(name)}.</p>
<h1 style="margin:0 0 16px;font-size:30px;line-height:1.15;color:#007f90">Trivia disponible</h1>
<p style="font-size:16px;line-height:1.65;margin:0 0 22px">Puedes consultar la trivia del periodo actual desde tu cuenta de Zona Diamante.</p>
<p style="background:#edf7f8;border-radius:12px;padding:18px;font-size:17px;margin:0 0 26px"><strong>{questions} preguntas</strong> · Puntuación máxima: <strong>{questions * points} puntos</strong></p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#f78019;border-radius:12px"><a href="{escape(play, quote=True)}" style="display:inline-block;padding:16px 26px;color:#ffffff;font-size:17px;font-weight:bold;text-decoration:none">Consultar trivia</a></td></tr></table>
<p style="font-size:13px;line-height:1.6;color:#68747b;margin:24px 0 0">Disponible hasta el siguiente cambio de turno. Puedes administrar estos avisos desde Perfil.</p></td></tr>
<tr><td style="padding:22px 28px;border-top:1px solid #e5ebee;font-size:12px;line-height:1.6;color:#68747b">Recibes este aviso porque activaste los avisos de trivia en tu perfil.<br><a href="{escape(unsubscribe, quote=True)}" style="color:#007f90">Desactivar avisos de trivia</a></td></tr>
</table></body></html>'''
    return {'subject': subject, 'html': html, 'text': text}


class DeliveryError(RuntimeError):
    def __init__(self, code: str, *, retry: bool, definitely_unsent: bool = False):
        super().__init__(code)
        self.code, self.retry, self.definitely_unsent = code, retry, definitely_unsent


async def send_notice(client: httpx.AsyncClient, job: dict) -> str | None:
    if not public_recipient(job['recipient_email']):
        raise DeliveryError('reserved_or_invalid_recipient', retry=False, definitely_unsent=True)
    notice = render_notice(job)
    payload = {
        'sender': {'name': settings.email_from_name, 'email': settings.email_from_address},
        'to': [{'email': job['recipient_email'], 'name': job['recipient_name']}],
        'replyTo': {'email': settings.email_from_address, 'name': settings.email_from_name},
        'subject': notice['subject'], 'htmlContent': notice['html'], 'textContent': notice['text'],
        'headers': {'idempotencyKey': str(UUID(str(job['id'])))},
        'tags': ['trivia-nueva'],
    }
    try:
        response = await client.post('https://api.brevo.com/v3/smtp/email',
            headers={'api-key': settings.brevo_api_key.get_secret_value()}, json=payload)
    except httpx.HTTPError as error:
        raise DeliveryError('provider_unreachable', retry=True) from error
    try:
        data = response.json()
    except ValueError:
        data = {}
    if response.status_code == 201 and data.get('messageId'):
        return str(data['messageId'])
    # Brevo's idempotency response is proof of a previous accepted send.
    if response.status_code == 400 and data.get('code') == 'duplicate_parameter' and 'idempotency' in str(data.get('message', '')).lower():
        return None
    if response.status_code in (401, 403, 429):
        raise DeliveryError('provider_' + str(response.status_code), retry=True, definitely_unsent=True)
    raise DeliveryError('provider_' + str(response.status_code),
        retry=response.status_code >= 500 or response.status_code in (200, 202, 408))


async def verify_sender(client: httpx.AsyncClient) -> None:
    try:
        reply = await client.get('https://api.brevo.com/v3/senders',
            headers={'api-key': settings.brevo_api_key.get_secret_value()})
        if reply.status_code == 200 and any(
            row.get('email', '').casefold() == settings.email_from_address.casefold() and row.get('active') is True
            for row in reply.json().get('senders', [])
        ):
            return
    except (httpx.HTTPError, ValueError):
        pass
    raise RuntimeError('Brevo sender is not verified or cannot be checked.')


async def dispatch() -> dict:
    if not settings.trivia_email_enabled:
        return {'enabled': False, 'queued': 0, 'sent': 0, 'failed': 0}
    if configuration_errors():
        raise RuntimeError('Email delivery is not configured.')
    day, slot = get_current_trivia_period()
    trivia = await get_or_create_daily_trivia(day, slot)
    trivia_id = trivia['daily_trivia_id']
    async with httpx.AsyncClient(timeout=8.0) as client:
        await verify_sender(client)
        queued = await supabase_rest_request('POST', 'rpc/prepare_trivia_emails',
            json={'p_trivia_id': trivia_id, 'p_timezone': settings.trivia_timezone})
        result = {'enabled': True, 'queued': queued, 'sent': 0, 'failed': 0}
        for _ in range(settings.trivia_email_batch_size):
            job = await supabase_rest_request('POST', 'rpc/claim_trivia_email', json={'p_trivia_id': trivia_id})
            if not job:
                break
            body = {'p_id': job['id'], 'p_lease': job['lease_token']}
            try:
                message_id = await send_notice(client, job)
                body.update(p_status='sent', p_message_id=message_id)
                result['sent'] += 1
            except DeliveryError as error:
                body.update(p_status='retry' if error.retry else 'failed',
                    p_error=error.code, p_definitely_unsent=error.definitely_unsent)
                result['failed'] += 1
            finished = await supabase_rest_request('POST', 'rpc/finish_trivia_email', json=body)
            if not finished:
                raise RuntimeError('Delivery lease changed before confirmation.')
            if body['p_status'] == 'retry':
                break  # Outage, quota or bad configuration: don't hammer the provider.
    return result
