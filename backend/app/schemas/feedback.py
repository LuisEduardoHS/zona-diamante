from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FeedbackCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    request_id: UUID
    reason: Literal['problem', 'suggestion', 'question']
    contact: str = Field(default='', max_length=200)
    message: str = Field(min_length=10, max_length=4000)


class FeedbackReceived(BaseModel):
    id: UUID
    status: Literal['received']
