from pydantic import BaseModel, ConfigDict, Field

from app.schemas.game_beta import BetaRead
from typing import Literal


class BufferedStart(BaseModel):
    model_config = ConfigDict(extra='forbid')


class BufferedInput(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    pitch: int = Field(ge=1, le=10000, strict=True)
    at_ms: float | None = Field(ge=0, le=60000, strict=True)


class BufferedComplete(BaseModel):
    model_config = ConfigDict(extra='forbid')
    events: list[BufferedInput] = Field(min_length=3, max_length=10000)


class BufferedRead(BetaRead):
    transport: Literal['buffered-1']
