from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.schemas.auth import CurrentUser
from app.schemas.reward import RewardRead
from app.services.rewards import get_rewards_for_user


router = APIRouter(
    prefix="/api/v1/rewards",
    tags=["rewards"],
)


@router.get(
    "",
    response_model=list[RewardRead],
)
async def read_rewards(
    current_user: Annotated[
        CurrentUser,
        Depends(get_current_user),
    ],
) -> list[RewardRead]:
    try:
        return await get_rewards_for_user(
            current_user.id,
        )
    except SupabaseRestError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not retrieve rewards.",
        ) from error