from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.schemas.auth import CurrentUser
from app.schemas.game_beta import BetaStart, BetaRevision, BetaProbe, BetaTransition, BetaComplete, BetaRead
from app.services import game_beta

router = APIRouter(prefix='/api/v1/games/beta', tags=['game-beta'])
User = Annotated[CurrentUser, Depends(get_current_user)]
Key = Annotated[str, Header(alias='Idempotency-Key', min_length=1, max_length=128)]


async def execute(user: CurrentUser, action: str, **kwargs):
    try:
        return await game_beta.command(user.id, action, **kwargs)
    except game_beta.InvalidBetaKey as error:
        raise HTTPException(422, str(error)) from error
    except SupabaseRestError as error:
        known = {
            'Profile not found.': 404, 'Beta not found.': 404,
            'Beta already active.': 409, 'Beta key conflict.': 409,
            'Beta revision conflict.': 409, 'Beta sequence conflict.': 409,
            'Beta pitch not started.': 409, 'Beta latency too high.': 409,
            'Beta start rate limit.': 429, 'Beta command limit.': 429,
            'Invalid beta command.': 422,
        }
        code = known.get(error.detail, 502)
        raise HTTPException(code, error.detail if error.detail in known else 'Could not process official game.') from error


@router.get('/config')
async def config():
    return {**game_beta.RULES,
            'protocol': {'compensation_cap_ms': 160, 'max_probe_ms': 250, 'expires_ms': 480000,
                         'daily_timezone': 'America/Mexico_City', 'minimum_swings': 3}}


@router.get('/current', response_model=BetaRead | None)
async def current(user: User):
    return await execute(user, 'current')


@router.post('', response_model=BetaRead)
async def start(payload: BetaStart, user: User, idempotency_key: Key):
    return await execute(user, 'start', mode=payload.mode, key=idempotency_key)


@router.get('/{game_id}', response_model=BetaRead)
async def read(game_id: UUID, user: User):
    return await execute(user, 'read', game_id=game_id)


@router.post('/{game_id}/probe', response_model=BetaRead)
async def probe(game_id: UUID, payload: BetaProbe, user: User, idempotency_key: Key):
    return await execute(user, 'probe', game_id=game_id, key=idempotency_key,
                         revision=payload.expected_revision, probe=payload.probe)


@router.post('/{game_id}/pitches', response_model=BetaRead)
async def pitch(game_id: UUID, payload: BetaRevision, user: User, idempotency_key: Key):
    return await execute(user, 'pitch', game_id=game_id, key=idempotency_key, revision=payload.expected_revision)


@router.post('/{game_id}/pitches/{pitch_id}/swing', response_model=BetaRead)
async def swing(game_id: UUID, pitch_id: UUID, payload: BetaRevision, user: User, idempotency_key: Key):
    return await execute(user, 'swing', game_id=game_id, key=idempotency_key,
                         revision=payload.expected_revision, pitch_id=pitch_id)


@router.post('/{game_id}/transitions', response_model=BetaRead)
async def transition(game_id: UUID, payload: BetaTransition, user: User, idempotency_key: Key):
    return await execute(user, payload.action, game_id=game_id, key=idempotency_key, revision=payload.expected_revision)


@router.post('/{game_id}/complete', response_model=BetaRead)
async def complete(game_id: UUID, payload: BetaComplete, user: User, idempotency_key: Key):
    return await execute(user, 'complete', game_id=game_id, key=idempotency_key)
