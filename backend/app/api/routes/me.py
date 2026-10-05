from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.schemas.auth import CurrentUser

router = APIRouter(
    prefix="/api/v1",
    tags=["auth"],
)

@router.get("/me", response_model=CurrentUser)
async def read_me(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    return current_user