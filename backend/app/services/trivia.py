from datetime import date, datetime
import logging
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import settings
from app.db.supabase import SupabaseRestError, supabase_rest_request
from app.schemas.trivia import TriviaDailyStatusRead


logger = logging.getLogger(
    "zona_diamante.trivia"
)


def get_current_trivia_date() -> date:
    try:
        timezone = ZoneInfo(
            settings.trivia_timezone
        )
    except ZoneInfoNotFoundError as error:
        raise RuntimeError(
            "Trivia timezone is not configured correctly."
        ) from error

    return datetime.now(timezone).date()


async def get_or_create_daily_trivia(
    trivia_date: date,
) -> dict:
    data = await supabase_rest_request(
        "POST",
        "rpc/get_or_create_daily_trivia",
        json={
            "p_trivia_date": trivia_date.isoformat(),
        },
    )

    if not isinstance(data, list) or len(data) != 1:
        raise SupabaseRestError(
            500,
            "Could not get or create daily trivia.",
        )

    return data[0]


async def get_daily_trivia_status_for_user(
    user_id: str,
) -> TriviaDailyStatusRead:
    trivia_date = get_current_trivia_date()

    trivia = await get_or_create_daily_trivia(
        trivia_date,
    )

    daily_trivia_id = trivia.get(
        "daily_trivia_id"
    )
    question_count = trivia.get(
        "question_count"
    )
    points_per_correct = trivia.get(
        "points_per_correct"
    )

    if (
        daily_trivia_id is None
        or question_count is None
        or points_per_correct is None
    ):
        raise SupabaseRestError(
            500,
            "Daily trivia data is incomplete.",
        )

    attempts = await supabase_rest_request(
        "GET",
        "activity_attempts",
        params={
            "select": "id,status,score",
            "user_id": f"eq.{user_id}",
            "activity_type": "eq.trivia",
            "daily_trivia_id": (
                f"eq.{daily_trivia_id}"
            ),
            "limit": "1",
        },
    )

    if not isinstance(attempts, list):
        raise SupabaseRestError(
            500,
            "Could not retrieve trivia attempt.",
        )

    if not attempts:
        return TriviaDailyStatusRead(
            daily_trivia_id=daily_trivia_id,
            trivia_date=trivia_date,
            status="available",
            question_count=question_count,
            points_per_correct=points_per_correct,
            max_points=(
                question_count
                * points_per_correct
            ),
            attempt_id=None,
            score=None,
        )

    attempt = attempts[0]

    attempt_status = attempt.get("status")

    if attempt_status == "started":
        trivia_status = "in_progress"

    elif attempt_status == "completed":
        trivia_status = "completed"

    else:
        raise SupabaseRestError(
            500,
            "Unexpected trivia attempt status.",
        )

    logger.info(
        "daily_trivia_status user_id=%s "
        "daily_trivia_id=%s status=%s",
        user_id,
        daily_trivia_id,
        trivia_status,
    )

    return TriviaDailyStatusRead(
        daily_trivia_id=daily_trivia_id,
        trivia_date=trivia_date,
        status=trivia_status,
        question_count=question_count,
        points_per_correct=points_per_correct,
        max_points=(
            question_count
            * points_per_correct
        ),
        attempt_id=attempt.get("id"),
        score=attempt.get("score"),
    )