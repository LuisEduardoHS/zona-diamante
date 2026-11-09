from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, ConfigDict, Field

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError, supabase_rest_request
from app.schemas.auth import CurrentUser
from app.services import trivia_email

router = APIRouter(tags=['email-notifications'])
User = Annotated[CurrentUser, Depends(get_current_user)]


class Preferences(BaseModel):
    model_config = ConfigDict(extra='forbid')
    trivia_email_enabled: bool = Field(strict=True)


@router.get('/api/v1/email/preferences', response_model=Preferences)
async def read_preferences(user: User):
    try:
        return await trivia_email.preference(user.id)
    except SupabaseRestError as error:
        raise HTTPException(503, 'No pudimos consultar tus avisos. Reintenta.') from error


@router.patch('/api/v1/email/preferences', response_model=Preferences)
async def update_preferences(payload: Preferences, user: User):
    try:
        return await trivia_email.preference(user.id, payload.trivia_email_enabled)
    except SupabaseRestError as error:
        raise HTTPException(503, 'No pudimos guardar tu preferencia. Reintenta.') from error


def unsubscribe_page(token: UUID, *, completed=False) -> HTMLResponse:
    title = 'Avisos desactivados' if completed else 'Desactivar avisos de trivia'
    copy = 'Ya no recibirás correos cuando haya una nueva trivia. Puedes volver a activarlos desde tu perfil.' if completed else 'Dejarás de recibir estos avisos. Tu cuenta y tus puntos seguirán disponibles.'
    form = '' if completed else f'<form method="post" action="/api/v1/email/trivia/unsubscribe/{token}"><button type="submit">Desactivar avisos</button></form>'
    return HTMLResponse(f'''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>{title} | Zona Diamante</title><style>body{{margin:0;padding:48px 24px;background:#f4f7f8;color:#2b2b31;font:17px/1.6 Arial,sans-serif}}main{{max-width:480px;margin:auto;padding:32px;background:white;border-radius:20px}}h1{{color:#007f90;font-size:28px}}button{{background:#f78019;color:white;border:0;border-radius:12px;padding:16px 22px;font-weight:bold;font-size:16px;cursor:pointer}}</style><main><strong>Zona Diamante</strong><h1>{title}</h1><p>{copy}</p>{form}</main></html>''', headers={'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'})


@router.get('/api/v1/email/trivia/unsubscribe/{token}', response_class=HTMLResponse, include_in_schema=False)
async def confirm_unsubscribe(token: UUID):
    # Link scanners/prefetching must not change a preference through a GET.
    return unsubscribe_page(token)


@router.post('/api/v1/email/trivia/unsubscribe/{token}', response_class=HTMLResponse, include_in_schema=False)
async def unsubscribe(token: UUID):
    try:
        await supabase_rest_request('POST', 'rpc/unsubscribe_trivia_email', json={'p_token': str(token)})
    except SupabaseRestError as error:
        raise HTTPException(503, 'No pudimos desactivar los avisos. Reintenta.') from error
    return unsubscribe_page(token, completed=True)


@router.post('/api/v1/internal/trivia-email/dispatch', include_in_schema=False)
async def run_dispatch(x_cron_secret: Annotated[str, Header()] = ''):
    if not trivia_email.authorized_dispatch(x_cron_secret):
        raise HTTPException(401, 'Unauthorized job.')
    try:
        return await trivia_email.dispatch()
    except (SupabaseRestError, RuntimeError) as error:
        raise HTTPException(503, 'Email dispatch unavailable.') from error
