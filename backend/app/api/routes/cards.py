from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    status,
)

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.schemas.auth import CurrentUser
from app.schemas.card import (
    CardCollectionRead,
    CardPurchaseResult,
)
from app.services.cards import (
    ProfileNotFoundError,
    get_collection_for_user,
    purchase_card_for_user,
)


router = APIRouter(
    prefix="/api/v1/cards",
    tags=["cards"],
)


@router.get(
    "",
    response_model=CardCollectionRead,
)
async def read_card_collection(
    current_user: Annotated[
        CurrentUser,
        Depends(get_current_user),
    ],
) -> CardCollectionRead:
    try:
        return await get_collection_for_user(
            current_user.id,
        )

    except ProfileNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found.",
        ) from error

    except SupabaseRestError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not retrieve card collection.",
        ) from error


@router.post(
    "/{card_id}/purchase",
    response_model=CardPurchaseResult,
)
async def purchase_card(
    card_id: int,
    idempotency_key: Annotated[
        str,
        Header(
            alias="Idempotency-Key",
            min_length=1,
            max_length=128,
        ),
    ],
    current_user: Annotated[
        CurrentUser,
        Depends(get_current_user),
    ],
) -> CardPurchaseResult:
    try:
        return await purchase_card_for_user(
            user_id=current_user.id,
            card_id=card_id,
            idempotency_key=idempotency_key,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error

    except SupabaseRestError as error:
        known_errors = {
            "Card not found.": (
                status.HTTP_404_NOT_FOUND,
                "Card not found.",
            ),
            "Profile not found.": (
                status.HTTP_404_NOT_FOUND,
                "Profile not found.",
            ),
            "Card is not active.": (
                status.HTTP_409_CONFLICT,
                "Card is not available.",
            ),
            "Card cannot be purchased with points.": (
                status.HTTP_409_CONFLICT,
                "This card cannot be purchased with points.",
            ),
            "Card already owned.": (
                status.HTTP_409_CONFLICT,
                "Card already owned.",
            ),
            "Insufficient points balance.": (
                status.HTTP_409_CONFLICT,
                "Insufficient points balance.",
            ),
            "Idempotency key belongs to another operation.": (
                status.HTTP_409_CONFLICT,
                "Idempotency key belongs to another operation.",
            ),
            "Economic operation state is inconsistent.": (
                status.HTTP_409_CONFLICT,
                "The purchase could not be confirmed. Please contact support.",
            ),
        }

        mapped_error = known_errors.get(
            error.detail
        )

        if mapped_error is not None:
            status_code, detail = mapped_error

            raise HTTPException(
                status_code=status_code,
                detail=detail,
            ) from error

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not purchase card.",
        ) from error
