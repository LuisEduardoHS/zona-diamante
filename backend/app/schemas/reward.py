from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class RewardRead(BaseModel):
    id: UUID
    user_id: UUID
    attempt_id: UUID | None = None
    event_type: str
    points_delta: int
    card_id: int | None = None
    idempotency_key: str
    metadata: dict[str, Any] | None = None
    created_at: datetime

class ActivityCompletionResult(BaseModel):
    reward_id: UUID
    attempt_id: UUID
    user_id: UUID
    points_delta: int
    points_balance: int
    already_processed: bool