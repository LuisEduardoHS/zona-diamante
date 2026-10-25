from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GameStart(BaseModel):
    model_config = ConfigDict(extra="forbid")

    restart_of: UUID | None = None


class GameTransition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["pause", "resume", "abandon"]
    expected_revision: int = Field(ge=0, le=2147483646, strict=True)


class GameRead(BaseModel):
    id: UUID
    game_state: Literal["active", "paused", "abandoned"]
    game_revision: int
    started_at: datetime
    completed_at: datetime | None = None
    # No client result, score, prize or economic completion contract exists yet.
    rewards_enabled: Literal[False] = False
