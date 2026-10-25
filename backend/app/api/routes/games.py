from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.schemas.auth import CurrentUser
from app.schemas.game import GameRead, GameStart, GameTransition
from app.services import games


router = APIRouter(prefix="/api/v1/games", tags=["games"])
AuthenticatedUser = Annotated[CurrentUser, Depends(get_current_user)]
RequestKey = Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=128)]


def database_error(error: SupabaseRestError) -> HTTPException:
    known = {
        "Profile not found.": (404, "Profile not found."),
        "Game not found.": (404, "Game not found."),
        "Game transition conflict.": (409, "Game transition conflict. Refresh the game state."),
        "Game already restarted.": (409, "Game already restarted. Retry with the original request key."),
    }
    code, detail = known.get(error.detail, (502, "Could not process game request."))
    return HTTPException(status_code=code, detail=detail)


@router.post("", response_model=GameRead)
async def start_game(payload: GameStart, idempotency_key: RequestKey, current_user: AuthenticatedUser) -> GameRead:
    try:
        return await games.start_game(current_user.id, idempotency_key, payload.restart_of)
    except games.InvalidGameKey as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except SupabaseRestError as error:
        raise database_error(error) from error


@router.get("/{game_id}", response_model=GameRead)
async def read_game(game_id: UUID, current_user: AuthenticatedUser) -> GameRead:
    try:
        game = await games.get_game(current_user.id, game_id)
    except SupabaseRestError as error:
        raise database_error(error) from error
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found.")
    return game


@router.post("/{game_id}/transitions", response_model=GameRead)
async def transition_game(game_id: UUID, payload: GameTransition, current_user: AuthenticatedUser) -> GameRead:
    try:
        return await games.transition_game(current_user.id, game_id, payload)
    except SupabaseRestError as error:
        raise database_error(error) from error
