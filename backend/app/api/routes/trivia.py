from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.schemas.auth import CurrentUser
from app.schemas.trivia import TriviaDailyStatusRead
from app.services.trivia import get_daily_trivia_status_for_user


router = APIRouter(
    prefix="/api/v1/trivia",
    tags=["trivia"],
)


@router.get(
    "/daily",
    response_model=TriviaDailyStatusRead,
)
async def read_daily_trivia(
    current_user: Annotated[
        CurrentUser,
        Depends(get_current_user),
    ],
) -> TriviaDailyStatusRead:
    try:
        return await get_daily_trivia_status_for_user(
            str(current_user.id)
        )

    except SupabaseRestError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not retrieve daily trivia.",
        ) from error

    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Trivia configuration is invalid.",
        ) from error