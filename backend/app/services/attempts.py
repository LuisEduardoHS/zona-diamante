import logging

from app.db.supabase import SupabaseRestError, supabase_rest_request
from app.schemas.attempt import AttemptCreate, AttemptRead

logger = logging.getLogger(
    "zona_diamante.attempts"
)

ATTEMPT_SELECT = (
    "id,user_id,activity_type,status,score,"
    "started_at,completed_at,metadata"
)


async def create_attempt(
    user_id: str,
    payload: AttemptCreate,
) -> AttemptRead:
    data = await supabase_rest_request(
        "POST",
        "activity_attempts",
        json={
            "user_id": user_id,
            "activity_type": payload.activity_type,
            "metadata": payload.metadata,
        },
        params={
            "select": ATTEMPT_SELECT,
        },
        headers={
            "Prefer": "return=representation",
        },
    )

    if not isinstance(data, list) or len(data) != 1:
        raise SupabaseRestError(
            500,
            "Could not create activity attempt.",
        )

        attempt = AttemptRead.model_validate(data[0])

        logger.info(
            "activity_attempt_created user_id=%s attempt_id=%s activity_type=%s",
            user_id,
            attempt.id,
            attempt.activity_type,
        )

        return attempt


async def get_attempt_for_user(
    attempt_id: str,
    user_id: str,
) -> AttemptRead | None:
    data = await supabase_rest_request(
        "GET",
        "activity_attempts",
        params={
            "select": ATTEMPT_SELECT,
            "id": f"eq.{attempt_id}",
            "user_id": f"eq.{user_id}",
            "limit": "1",
        },
    )

    if not isinstance(data, list) or not data:
        return None

    return AttemptRead.model_validate(data[0])