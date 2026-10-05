import logging

from app.db.supabase import supabase_rest_request

from typing import Any

from app.schemas.reward import ActivityCompletionResult, RewardRead

logger = logging.getLogger(
    "zona_diamante.rewards"
)

REWARD_SELECT = (
    "id,user_id,attempt_id,event_type,points_delta,"
    "card_id,idempotency_key,metadata,created_at"
)


async def get_rewards_for_user(
    user_id: str,
    *,
    limit: int = 50,
) -> list[RewardRead]:
    safe_limit = max(1, min(limit, 100))

    data = await supabase_rest_request(
        "GET",
        "reward_events",
        params={
            "select": REWARD_SELECT,
            "user_id": f"eq.{user_id}",
            "order": "created_at.desc",
            "limit": str(safe_limit),
        },
    )

    if not isinstance(data, list):
        return []

    return [
        RewardRead.model_validate(item)
        for item in data
    ]


async def get_reward_for_attempt(
    user_id: str,
    attempt_id: str,
) -> RewardRead | None:
    data = await supabase_rest_request(
        "GET",
        "reward_events",
        params={
            "select": REWARD_SELECT,
            "user_id": f"eq.{user_id}",
            "attempt_id": f"eq.{attempt_id}",
            "limit": "1",
        },
    )

    if not isinstance(data, list) or not data:
        return None

    return RewardRead.model_validate(data[0])

async def complete_attempt_transaction(
    *,
    user_id: str,
    attempt_id: str,
    event_type: str,
    idempotency_key: str,
    score: int | None = None,
    points_delta: int = 0,
    metadata: dict[str, Any] | None = None,
) -> ActivityCompletionResult:
    event_type = event_type.strip()
    idempotency_key = idempotency_key.strip()

    if not event_type or len(event_type) > 64:
        raise ValueError(
            "event_type must contain between 1 and 64 characters."
        )

    if not idempotency_key or len(idempotency_key) > 128:
        raise ValueError(
            "idempotency_key must contain between 1 and 128 characters."
        )

    data = await supabase_rest_request(
        "POST",
        "rpc/complete_activity_attempt",
        json={
            "p_user_id": user_id,
            "p_attempt_id": attempt_id,
            "p_event_type": event_type,
            "p_idempotency_key": idempotency_key,
            "p_score": score,
            "p_points_delta": points_delta,
            "p_metadata": metadata or {},
        },
    )

    result = ActivityCompletionResult.model_validate(data)

    logger.info(
        "activity_completion_processed "
        "user_id=%s attempt_id=%s already_processed=%s",
        user_id,
        attempt_id,
        result.already_processed,
    )

    return result