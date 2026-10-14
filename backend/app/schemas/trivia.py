from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


TriviaDailyStatus = Literal[
    "available",
    "in_progress",
    "completed",
]


class TriviaDailyStatusRead(BaseModel):
    daily_trivia_id: UUID
    trivia_date: date
    status: TriviaDailyStatus

    question_count: int
    points_per_correct: int
    max_points: int

    attempt_id: UUID | None = None
    score: int | None = None


class TriviaOptionRead(BaseModel):
    id: UUID
    text: str
    position: int


class TriviaQuestionRead(BaseModel):
    id: UUID
    text: str
    position: int
    category: str | None = None
    difficulty: str | None = None

    options: list[TriviaOptionRead]


class TriviaDailyStartRead(BaseModel):
    daily_trivia_id: UUID
    trivia_date: date

    attempt_id: UUID
    status: Literal["in_progress"]

    question_count: int
    points_per_correct: int
    max_points: int

    questions: list[TriviaQuestionRead]