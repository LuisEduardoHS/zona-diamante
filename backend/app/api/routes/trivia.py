from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.schemas.auth import CurrentUser
from app.schemas.trivia import (
    TriviaAnswerRead,
    TriviaAnswerUpdate,
    TriviaDailyStartRead,
    TriviaDailyStatusRead,
    TriviaDailySubmitRead,
)
from app.services.trivia import (
    TriviaRequestError,
    get_daily_trivia_status_for_user,
    save_daily_trivia_answer_for_user,
    start_daily_trivia_for_user,
    submit_daily_trivia_for_user,
)


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


@router.post(
    "/daily/start",
    response_model=TriviaDailyStartRead,
)
async def start_daily_trivia(
    current_user: Annotated[
        CurrentUser,
        Depends(get_current_user),
    ],
) -> TriviaDailyStartRead:
    try:
        return await start_daily_trivia_for_user(
            str(current_user.id)
        )
    except TriviaRequestError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail=error.detail,
        ) from error
    except SupabaseRestError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not start daily trivia.",
        ) from error


@router.put(
    "/daily/answers/{question_id}",
    response_model=TriviaAnswerRead,
)
async def save_daily_trivia_answer(
    question_id: UUID,
    payload: TriviaAnswerUpdate,
    current_user: Annotated[
        CurrentUser,
        Depends(get_current_user),
    ],
) -> TriviaAnswerRead:
    try:
        return await save_daily_trivia_answer_for_user(
            str(current_user.id),
            str(question_id),
            str(payload.selected_option_id),
        )
    except TriviaRequestError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail=error.detail,
        ) from error
    except SupabaseRestError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not save daily trivia answer.",
        ) from error


@router.post(
    "/daily/submit",
    response_model=TriviaDailySubmitRead,
)
async def submit_daily_trivia(
    current_user: Annotated[
        CurrentUser,
        Depends(get_current_user),
    ],
) -> TriviaDailySubmitRead:
    try:
        return await submit_daily_trivia_for_user(
            str(current_user.id)
        )
    except TriviaRequestError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail=error.detail,
        ) from error
    except SupabaseRestError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not complete daily trivia.",
        ) from error
