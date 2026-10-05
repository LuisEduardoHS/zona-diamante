from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.schemas.attempt import AttemptCreate, AttemptRead
from app.schemas.auth import CurrentUser
from app.services.attempts import create_attempt, get_attempt_for_user

from uuid import UUID

router = APIRouter(
    prefix="/api/v1/attempts",
    tags=["attempts"],
)


@router.post(
    "",
    response_model=AttemptRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_activity_attempt(
    payload: AttemptCreate,
    current_user: Annotated[
        CurrentUser,
        Depends(get_current_user),
    ],
) -> AttemptRead:
    try:
        return await create_attempt(
            current_user.id,
            payload,
        )
    except SupabaseRestError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not create activity attempt.",
        ) from error


@router.get(
    "/{attempt_id}",
    response_model=AttemptRead,
)
async def read_activity_attempt(
    attempt_id: UUID,
    current_user: Annotated[
        CurrentUser,
        Depends(get_current_user),
    ],
) -> AttemptRead:
    try:
        attempt = await get_attempt_for_user(
            attempt_id,
            current_user.id,
        )
    except SupabaseRestError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not retrieve activity attempt.",
        ) from error

    if attempt is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity attempt not found.",
        )

    return attempt