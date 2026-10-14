from datetime import date, datetime, time, timedelta
import logging
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import settings
from app.db.supabase import SupabaseRestError, supabase_rest_request
from app.schemas.trivia import (
    TriviaAnswerRead,
    TriviaDailyStartRead,
    TriviaDailyStatusRead,
    TriviaDailySubmitRead,
    TriviaOptionRead,
    TriviaQuestionRead,
    TriviaQuestionReviewRead,
)


logger = logging.getLogger("zona_diamante.trivia")


class TriviaRequestError(RuntimeError):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def get_trivia_timezone() -> ZoneInfo:
    try:
        return ZoneInfo(settings.trivia_timezone)
    except ZoneInfoNotFoundError as error:
        raise RuntimeError(
            "Trivia timezone is not configured correctly."
        ) from error


def get_current_trivia_date() -> date:
    return datetime.now(get_trivia_timezone()).date()


def get_next_available_at(trivia_date: date) -> datetime:
    return datetime.combine(
        trivia_date + timedelta(days=1),
        time.min,
        tzinfo=get_trivia_timezone(),
    )


async def get_or_create_daily_trivia(trivia_date: date) -> dict:
    data = await supabase_rest_request(
        "POST",
        "rpc/get_or_create_daily_trivia",
        json={"p_trivia_date": trivia_date.isoformat()},
    )

    if not isinstance(data, list) or len(data) != 1:
        raise SupabaseRestError(
            500,
            "Could not get or create daily trivia.",
        )

    return data[0]


def _validated_daily_trivia(trivia: dict) -> tuple[str, int, int]:
    daily_trivia_id = trivia.get("daily_trivia_id")
    question_count = trivia.get("question_count")
    points_per_correct = trivia.get("points_per_correct")

    if (
        not daily_trivia_id
        or not isinstance(question_count, int)
        or not isinstance(points_per_correct, int)
    ):
        raise SupabaseRestError(
            500,
            "Daily trivia data is incomplete.",
        )

    return daily_trivia_id, question_count, points_per_correct


async def _get_current_daily_trivia() -> tuple[date, dict]:
    trivia_date = get_current_trivia_date()
    trivia = await get_or_create_daily_trivia(trivia_date)
    _validated_daily_trivia(trivia)
    return trivia_date, trivia


async def _get_daily_attempt(user_id: str, daily_trivia_id: str) -> dict | None:
    attempts = await supabase_rest_request(
        "GET",
        "activity_attempts",
        params={
            "select": "id,status,score",
            "user_id": f"eq.{user_id}",
            "activity_type": "eq.trivia",
            "daily_trivia_id": f"eq.{daily_trivia_id}",
            "limit": "1",
        },
    )

    if not isinstance(attempts, list):
        raise SupabaseRestError(
            500,
            "Could not retrieve trivia attempt.",
        )

    return attempts[0] if attempts else None


async def _get_completion_values(
    user_id: str,
    attempt_id: str,
) -> tuple[int, int]:
    rewards = await supabase_rest_request(
        "GET",
        "reward_events",
        params={
            "select": "points_delta",
            "user_id": f"eq.{user_id}",
            "attempt_id": f"eq.{attempt_id}",
            "event_type": "eq.daily_trivia_completion",
            "limit": "1",
        },
    )
    profiles = await supabase_rest_request(
        "GET",
        "profiles",
        params={
            "select": "points_balance",
            "id": f"eq.{user_id}",
            "limit": "1",
        },
    )

    if (
        not isinstance(rewards, list)
        or len(rewards) != 1
        or not isinstance(profiles, list)
        or len(profiles) != 1
    ):
        raise SupabaseRestError(
            500,
            "Daily trivia completion data is incomplete.",
        )

    return rewards[0]["points_delta"], profiles[0]["points_balance"]


async def get_daily_trivia_status_for_user(
    user_id: str,
) -> TriviaDailyStatusRead:
    trivia_date, trivia = await _get_current_daily_trivia()
    daily_trivia_id, question_count, points_per_correct = (
        _validated_daily_trivia(trivia)
    )
    attempt = await _get_daily_attempt(user_id, daily_trivia_id)
    common = {
        "daily_trivia_id": daily_trivia_id,
        "trivia_date": trivia_date,
        "question_count": question_count,
        "points_per_correct": points_per_correct,
        "max_points": question_count * points_per_correct,
        "next_available_at": get_next_available_at(trivia_date),
    }

    if attempt is None:
        return TriviaDailyStatusRead(
            **common,
            status="available",
        )

    attempt_status = attempt.get("status")
    points_earned = None
    points_balance = None

    if attempt_status == "started":
        trivia_status = "in_progress"
    elif attempt_status == "completed":
        trivia_status = "completed"
        points_earned, points_balance = await _get_completion_values(
            user_id,
            attempt["id"],
        )
    else:
        raise SupabaseRestError(
            500,
            "Unexpected trivia attempt status.",
        )

    logger.info(
        "daily_trivia_status user_id=%s daily_trivia_id=%s status=%s",
        user_id,
        daily_trivia_id,
        trivia_status,
    )

    return TriviaDailyStatusRead(
        **common,
        status=trivia_status,
        attempt_id=attempt.get("id"),
        score=attempt.get("score"),
        points_earned=points_earned,
        points_balance=points_balance,
    )


def _in_filter(values: list[str]) -> str:
    return f"in.({','.join(values)})"


async def _load_daily_questions(
    daily_trivia_id: str,
    question_count: int,
    attempt_id: str,
) -> list[TriviaQuestionRead]:
    assignments = await supabase_rest_request(
        "GET",
        "daily_trivia_questions",
        params={
            "select": "question_id,position",
            "daily_trivia_id": f"eq.{daily_trivia_id}",
            "order": "position.asc",
        },
    )

    if not isinstance(assignments, list) or len(assignments) != question_count:
        raise SupabaseRestError(
            500,
            "Daily trivia questions are incomplete.",
        )

    question_ids = [str(item["question_id"]) for item in assignments]
    question_filter = _in_filter(question_ids)
    questions = await supabase_rest_request(
        "GET",
        "trivia_questions",
        params={
            "select": "id,question_text,category,difficulty",
            "id": question_filter,
        },
    )
    options = await supabase_rest_request(
        "GET",
        "trivia_options",
        params={
            "select": "id,question_id,option_text,position",
            "question_id": question_filter,
            "order": "question_id.asc,position.asc",
        },
    )
    answers = await supabase_rest_request(
        "GET",
        "trivia_attempt_answers",
        params={
            "select": "question_id,selected_option_id",
            "attempt_id": f"eq.{attempt_id}",
        },
    )

    if not all(isinstance(value, list) for value in (questions, options, answers)):
        raise SupabaseRestError(500, "Could not load daily trivia questions.")

    question_by_id = {str(item["id"]): item for item in questions}
    options_by_question: dict[str, list[dict]] = {}
    for option in options:
        options_by_question.setdefault(str(option["question_id"]), []).append(option)
    answer_by_question = {
        str(item["question_id"]): item["selected_option_id"]
        for item in answers
    }

    result: list[TriviaQuestionRead] = []
    for assignment in assignments:
        question_id = str(assignment["question_id"])
        question = question_by_id.get(question_id)
        question_options = options_by_question.get(question_id, [])
        if question is None or len(question_options) != 4:
            raise SupabaseRestError(500, "Daily trivia question data is incomplete.")

        question_options.sort(key=lambda item: item["position"])
        result.append(
            TriviaQuestionRead(
                id=question_id,
                text=question["question_text"],
                position=assignment["position"],
                category=question.get("category"),
                difficulty=question.get("difficulty"),
                selected_option_id=answer_by_question.get(question_id),
                options=[
                    TriviaOptionRead(
                        id=option["id"],
                        text=option["option_text"],
                        position=option["position"],
                    )
                    for option in question_options
                ],
            )
        )

    return result


async def start_daily_trivia_for_user(user_id: str) -> TriviaDailyStartRead:
    trivia_date, trivia = await _get_current_daily_trivia()
    daily_trivia_id, question_count, points_per_correct = (
        _validated_daily_trivia(trivia)
    )
    data = await supabase_rest_request(
        "POST",
        "rpc/get_or_create_daily_trivia_attempt",
        json={
            "p_user_id": user_id,
            "p_daily_trivia_id": daily_trivia_id,
        },
    )

    if not isinstance(data, list) or len(data) != 1:
        raise SupabaseRestError(500, "Could not start daily trivia attempt.")

    attempt = data[0]
    if attempt.get("attempt_status") == "completed":
        raise TriviaRequestError(409, "Daily trivia has already been completed.")
    if attempt.get("attempt_status") != "started" or not attempt.get("attempt_id"):
        raise SupabaseRestError(500, "Daily trivia attempt data is invalid.")

    questions = await _load_daily_questions(
        daily_trivia_id,
        question_count,
        attempt["attempt_id"],
    )

    resumed = any(question.selected_option_id is not None for question in questions)
    logger.info(
        "%s user_id=%s daily_trivia_id=%s attempt_id=%s",
        "daily_trivia_resumed" if resumed else "daily_trivia_started",
        user_id,
        daily_trivia_id,
        attempt["attempt_id"],
    )

    return TriviaDailyStartRead(
        daily_trivia_id=daily_trivia_id,
        trivia_date=trivia_date,
        attempt_id=attempt["attempt_id"],
        status="in_progress",
        question_count=question_count,
        points_per_correct=points_per_correct,
        max_points=question_count * points_per_correct,
        questions=questions,
    )


def _raise_known_rpc_error(error: SupabaseRestError) -> None:
    known_errors = {
        "Daily trivia attempt not found.": (409, "Daily trivia is not in progress."),
        "Daily trivia attempt is not in progress.": (409, "Daily trivia is not in progress."),
        "Question does not belong to the daily trivia.": (404, "Question is not part of today's trivia."),
        "Option does not belong to the question.": (422, "Selected option does not belong to the question."),
        "Daily trivia attempt has expired.": (409, "Daily trivia attempt has expired."),
        "Daily trivia attempt cannot be completed.": (409, "Daily trivia cannot be completed."),
    }
    for message, (status_code, detail) in known_errors.items():
        if message in error.detail:
            raise TriviaRequestError(status_code, detail) from error
    if "All daily trivia questions must be answered." in error.detail:
        raise TriviaRequestError(
            409,
            "Answer all daily trivia questions before submitting.",
        ) from error
    raise error


async def save_daily_trivia_answer_for_user(
    user_id: str,
    question_id: str,
    selected_option_id: str,
) -> TriviaAnswerRead:
    _, trivia = await _get_current_daily_trivia()
    daily_trivia_id, _, _ = _validated_daily_trivia(trivia)
    attempt = await _get_daily_attempt(user_id, daily_trivia_id)
    if attempt is None or attempt.get("status") != "started":
        raise TriviaRequestError(409, "Daily trivia is not in progress.")

    try:
        data = await supabase_rest_request(
            "POST",
            "rpc/save_daily_trivia_answer",
            json={
                "p_user_id": user_id,
                "p_attempt_id": attempt["id"],
                "p_daily_trivia_id": daily_trivia_id,
                "p_question_id": question_id,
                "p_selected_option_id": selected_option_id,
            },
        )
    except SupabaseRestError as error:
        _raise_known_rpc_error(error)

    logger.info(
        "daily_trivia_answer_saved user_id=%s daily_trivia_id=%s attempt_id=%s question_id=%s",
        user_id,
        daily_trivia_id,
        attempt["id"],
        question_id,
    )
    return TriviaAnswerRead.model_validate(data)


async def _load_daily_review(
    daily_trivia_id: str,
    attempt_id: str,
    question_count: int,
) -> list[TriviaQuestionReviewRead]:
    assignments = await supabase_rest_request(
        "GET",
        "daily_trivia_questions",
        params={
            "select": "question_id,position",
            "daily_trivia_id": f"eq.{daily_trivia_id}",
            "order": "position.asc",
        },
    )
    if not isinstance(assignments, list) or len(assignments) != question_count:
        raise SupabaseRestError(500, "Daily trivia review is incomplete.")

    question_ids = [str(item["question_id"]) for item in assignments]
    question_filter = _in_filter(question_ids)
    questions = await supabase_rest_request(
        "GET",
        "trivia_questions",
        params={
            "select": "id,explanation",
            "id": question_filter,
        },
    )
    options = await supabase_rest_request(
        "GET",
        "trivia_options",
        params={
            "select": "id,question_id,is_correct",
            "question_id": question_filter,
        },
    )
    answers = await supabase_rest_request(
        "GET",
        "trivia_attempt_answers",
        params={
            "select": "question_id,selected_option_id",
            "attempt_id": f"eq.{attempt_id}",
        },
    )
    if not all(isinstance(value, list) for value in (questions, options, answers)):
        raise SupabaseRestError(500, "Could not load daily trivia review.")

    explanation_by_question = {
        str(item["id"]): item.get("explanation") or ""
        for item in questions
    }
    correct_by_question = {
        str(item["question_id"]): str(item["id"])
        for item in options
        if item.get("is_correct") is True
    }
    selected_by_question = {
        str(item["question_id"]): str(item["selected_option_id"])
        for item in answers
    }

    review = []
    for assignment in assignments:
        question_id = str(assignment["question_id"])
        selected = selected_by_question.get(question_id)
        correct = correct_by_question.get(question_id)
        explanation = explanation_by_question.get(question_id)
        if not selected or not correct or not explanation:
            raise SupabaseRestError(500, "Daily trivia review data is incomplete.")
        review.append(
            TriviaQuestionReviewRead(
                question_id=question_id,
                selected_option_id=selected,
                correct_option_id=correct,
                is_correct=selected == correct,
                explanation=explanation,
            )
        )

    return review


async def submit_daily_trivia_for_user(user_id: str) -> TriviaDailySubmitRead:
    trivia_date, trivia = await _get_current_daily_trivia()
    daily_trivia_id, question_count, _ = _validated_daily_trivia(trivia)
    attempt = await _get_daily_attempt(user_id, daily_trivia_id)
    if attempt is None:
        raise TriviaRequestError(409, "Daily trivia is not in progress.")

    try:
        data = await supabase_rest_request(
            "POST",
            "rpc/complete_daily_trivia_attempt",
            json={
                "p_user_id": user_id,
                "p_attempt_id": attempt["id"],
                "p_daily_trivia_id": daily_trivia_id,
                "p_trivia_date": trivia_date.isoformat(),
            },
        )
    except SupabaseRestError as error:
        _raise_known_rpc_error(error)

    if not isinstance(data, dict):
        raise SupabaseRestError(500, "Daily trivia completion data is invalid.")

    review = await _load_daily_review(
        daily_trivia_id,
        attempt["id"],
        question_count,
    )
    result = TriviaDailySubmitRead(
        attempt_id=attempt["id"],
        status="completed",
        score=data["score"],
        question_count=data["question_count"],
        points_earned=data["points_earned"],
        points_balance=data["points_balance"],
        already_processed=data["already_processed"],
        next_available_at=get_next_available_at(trivia_date),
        review=review,
    )

    logger.info(
        "daily_trivia_completed user_id=%s daily_trivia_id=%s attempt_id=%s score=%s already_processed=%s",
        user_id,
        daily_trivia_id,
        attempt["id"],
        result.score,
        result.already_processed,
    )
    return result
