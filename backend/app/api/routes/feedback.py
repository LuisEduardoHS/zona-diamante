from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.schemas.auth import CurrentUser
from app.schemas.feedback import FeedbackCreate, FeedbackReceived
from app.services import feedback
from app.services.trivia_email import authorized_dispatch

router = APIRouter(tags=['help'])


@router.post('/api/v1/help/feedback', status_code=202, response_model=FeedbackReceived)
async def submit_feedback(payload: FeedbackCreate, user: Annotated[CurrentUser, Depends(get_current_user)],
    background: BackgroundTasks):
    if not feedback.configured():
        raise HTTPException(503, 'El envío de mensajes no está disponible. Intenta más tarde.')
    try:
        received = await feedback.submit(user.id, payload)
    except SupabaseRestError as error:
        if error.detail == 'Feedback rate limit exceeded.':
            raise HTTPException(429, 'Ya enviaste varios mensajes. Intenta más tarde.') from error
        if error.detail == 'Feedback request conflict.':
            raise HTTPException(409, 'Este envío ya tiene otro contenido. Recarga e intenta de nuevo.') from error
        if error.detail == 'Verified account required.':
            raise HTTPException(403, 'Confirma el correo de tu cuenta antes de enviar un mensaje.') from error
        raise HTTPException(503, 'No pudimos guardar tu mensaje. Reintenta; no se duplicará.') from error
    background.add_task(feedback.deliver_in_background, str(received['id']))
    return received


@router.post('/api/v1/internal/help-feedback/dispatch', include_in_schema=False)
async def dispatch_feedback(x_cron_secret: Annotated[str, Header()] = ''):
    if not authorized_dispatch(x_cron_secret):
        raise HTTPException(401, 'Unauthorized job.')
    try:
        return await feedback.dispatch()
    except (SupabaseRestError, RuntimeError) as error:
        raise HTTPException(503, 'Feedback dispatch unavailable.') from error
