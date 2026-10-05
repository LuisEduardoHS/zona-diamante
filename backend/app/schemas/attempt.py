from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

import json


ActivityType = Literal[
    "trivia",
    "game",
    "ar",
]

MAX_METADATA_BYTES = 16 * 1024

AttemptStatus = Literal[
    "started",
    "completed",
    "rejected",
    "expired",
]


class AttemptCreate(BaseModel):
    activity_type: ActivityType
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("metadata")
    @classmethod
    def validate_metadata_size(
        cls,
        value: dict[str, Any],
    ) -> dict[str, Any]:
        encoded = json.dumps(
            value,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")

        if len(encoded) > MAX_METADATA_BYTES:
            raise ValueError(
                "metadata cannot exceed 16 KB."
            )

        return value

class AttemptRead(BaseModel):
    id: UUID
    user_id: UUID
    activity_type: ActivityType
    status: AttemptStatus
    score: int | None = None
    started_at: datetime
    completed_at: datetime | None = None
    metadata: dict[str, Any] | None = None