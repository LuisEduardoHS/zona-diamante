"""Private support inbox; SMTP runs in Supabase, outside Render's port limits."""
import logging
import httpx
from app.core.config import settings
from app.db.supabase import supabase_rest_request
from app.services.trivia_email import public_recipient

logger = logging.getLogger('zona_diamante.feedback')


def configured() -> bool:
    return bool(settings.supabase_url and len(settings.email_dispatch_secret.get_secret_value())>=32
        and public_recipient(settings.feedback_recipient_email))


async def submit(user_id: str, payload) -> dict:
    return await supabase_rest_request('POST', 'rpc/submit_help_feedback', json={
        'p_user_id': user_id, 'p_request_id': str(payload.request_id),
        'p_reason': payload.reason, 'p_contact': payload.contact, 'p_message': payload.message,
        'p_recipient': settings.feedback_recipient_email})


async def dispatch(feedback_id: str | None = None) -> dict:
    if not configured():
        raise RuntimeError('Feedback delivery is not configured.')
    try:
        async with httpx.AsyncClient(timeout=50.0) as client:
            response = await client.post(settings.supabase_url.rstrip('/')+'/functions/v1/help-feedback-email',
                headers={'X-Feedback-Secret': settings.email_dispatch_secret.get_secret_value()}, json={'id':feedback_id})
        response.raise_for_status()
        result=response.json()
        if not isinstance(result,dict) or not all(type(result.get(k)) is int for k in ('accepted','failed')):
            raise ValueError('Invalid delivery receipt')
        return result
    except (httpx.HTTPError,ValueError) as error:
        raise RuntimeError('Feedback delivery temporarily unavailable.') from error


async def deliver_in_background(feedback_id: str) -> None:
    try:
        await dispatch(feedback_id)
    except RuntimeError:
        logger.warning('feedback_delivery_deferred id=%s',feedback_id)
