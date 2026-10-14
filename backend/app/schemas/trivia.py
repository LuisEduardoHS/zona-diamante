from datetime import date, datetime
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
    points_earned: int | None = None
    points_balance: int | None = None
    next_available_at: datetime


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
    selected_option_id: UUID | None = None

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


class TriviaAnswerUpdate(BaseModel):
    selected_option_id: UUID


class TriviaAnswerRead(BaseModel):
    question_id: UUID
    selected_option_id: UUID
    saved: bool


class TriviaQuestionReviewRead(BaseModel):
    question_id: UUID
    selected_option_id: UUID
    correct_option_id: UUID
    is_correct: bool
    explanation: str


class TriviaDailySubmitRead(BaseModel):
    attempt_id: UUID
    status: Literal["completed"]
    score: int
    question_count: int
    points_earned: int
    points_balance: int
    already_processed: bool
    next_available_at: datetime
    review: list[TriviaQuestionReviewRead]
