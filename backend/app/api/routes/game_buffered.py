from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.schemas.auth import CurrentUser
from app.schemas.game_buffered import BufferedStart, BufferedComplete, BufferedRead
from app.services import game_buffered
from app.services.game_beta import InvalidBetaKey

router = APIRouter(prefix='/api/v1/games/buffered', tags=['game-buffered'])
User = Annotated[CurrentUser, Depends(get_current_user)]
Key = Annotated[str, Header(alias='Idempotency-Key', min_length=1, max_length=128)]


async def execute(user: CurrentUser, action: str, **kwargs):
    try:
        return await game_buffered.command(user.id, action, **kwargs)
    except InvalidBetaKey as error:
        raise HTTPException(422, str(error)) from error
    except SupabaseRestError as error:
        known = {'Profile not found.': 404, 'Beta not found.': 404,
                 'Beta key conflict.': 409, 'Beta sequence conflict.': 409,
                 'Buffered duration not reached.': 409, 'Incomplete buffered game.': 422,
                 'Invalid buffered inputs.': 422, 'Invalid buffered command.': 422,
                 'Beta start rate limit.': 429}
        code = known.get(error.detail, 502)
        raise HTTPException(code, error.detail if error.detail in known else 'No pudimos confirmar los puntos. Puedes reintentar.') from error


@router.post('', response_model=BufferedRead)
async def start(payload: BufferedStart, user: User, idempotency_key: Key):
    return await execute(user, 'start', key=idempotency_key)


@router.get('/{game_id}', response_model=BufferedRead)
async def read(game_id: UUID, user: User):
    return await execute(user, 'read', game_id=game_id)


@router.post('/{game_id}/complete', response_model=BufferedRead)
async def complete(game_id: UUID, payload: BufferedComplete, user: User):
    return await execute(user, 'complete', game_id=game_id,
                         events=[event.model_dump() for event in payload.events])
