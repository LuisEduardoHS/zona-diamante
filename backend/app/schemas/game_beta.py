from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BetaStart(BaseModel):
    model_config = ConfigDict(extra='forbid')
    mode: Literal['classic', 'streak']


class BetaRevision(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expected_revision: int = Field(ge=0, le=2147483646, strict=True)


class BetaProbe(BetaRevision):
    probe: UUID


class BetaTransition(BetaRevision):
    action: Literal['pause', 'resume', 'abandon']


class BetaComplete(BaseModel):
    model_config = ConfigDict(extra='forbid')


class BetaReward(BaseModel):
    status: Literal['pending', 'confirmed', 'daily_limit', 'no_participation', 'disabled']
    points_awarded: int | None = None
    event_id: UUID | None = None


class BetaStats(BaseModel):
    resolved: int
    hits: int
    misses: int
    perfects: int
    score: int
    streak: int
    bestStreak: int
    swings: int


class BetaRead(BaseModel):
    id: UUID
    version: Literal['beta-1']
    mode: Literal['classic', 'streak']
    phase: Literal['waiting', 'pitch', 'paused', 'ready', 'completed', 'abandoned', 'expired']
    revision: int
    rules: dict[str, Any]
    expires_at: float
    server_now: float
    next_at: float
    probe: UUID
    samples: list[float]
    compensation_ms: float
    stats: BetaStats
    outcome: Literal['won', 'lost'] | None = None
    plan: dict[str, Any] | None = None
    pitch_id: UUID | None = None
    pitch_start: float | None = None
    paused_from: str | None = None
    last: dict[str, Any] | None = None
    reward: BetaReward
    points_balance: int
    rewarded_today: int
    daily_limit: int
