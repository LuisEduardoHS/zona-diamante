from datetime import date, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.api.routes import trivia as trivia_route
from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.main import app
from app.schemas.auth import CurrentUser
from app.schemas.trivia import (
    TriviaAnswerRead,
    TriviaDailyStartRead,
    TriviaDailyStatusRead,
    TriviaDailySubmitRead,
    TriviaOptionRead,
    TriviaQuestionRead,
    TriviaQuestionReviewRead,
)
from app.services import trivia as trivia_service


client = TestClient(app)

TEST_USER_ID = "11111111-1111-1111-1111-111111111111"
TEST_TRIVIA_ID = "22222222-2222-2222-2222-222222222222"
TEST_ATTEMPT_ID = "33333333-3333-3333-3333-333333333333"
TEST_QUESTION_ID = "44444444-4444-4444-4444-444444444444"
TEST_OPTION_ID = "55555555-5555-5555-5555-555555555555"
NEXT_AVAILABLE = datetime.fromisoformat("2026-10-15T00:00:00-06:00")


async def override_current_user():
    return CurrentUser(id=TEST_USER_ID, email="test@example.com")


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    ("method", "path", "json"),
    [
        ("get", "/api/v1/trivia/daily", None),
        ("post", "/api/v1/trivia/daily/start", None),
        ("put", f"/api/v1/trivia/daily/answers/{TEST_QUESTION_ID}", {"selected_option_id": TEST_OPTION_ID}),
        ("post", "/api/v1/trivia/daily/submit", None),
    ],
)
def test_daily_trivia_endpoints_require_authentication(method, path, json):
    response = client.request(method, path, json=json)
    assert response.status_code == 401


@pytest.mark.parametrize(
    ("trivia_status", "attempt_id", "score", "points"),
    [
        ("available", None, None, None),
        ("in_progress", TEST_ATTEMPT_ID, None, None),
        ("completed", TEST_ATTEMPT_ID, 4, 80),
    ],
)
def test_daily_trivia_returns_each_status(
    monkeypatch,
    trivia_status,
    attempt_id,
    score,
    points,
):
    async def fake_status(user_id: str):
        assert user_id == TEST_USER_ID
        return TriviaDailyStatusRead(
            daily_trivia_id=TEST_TRIVIA_ID,
            trivia_date=date(2026, 10, 14),
            status=trivia_status,
            question_count=5,
            points_per_correct=20,
            max_points=100,
            attempt_id=attempt_id,
            score=score,
            points_earned=points,
            points_balance=320 if points is not None else None,
            next_available_at=NEXT_AVAILABLE,
        )

    app.dependency_overrides[get_current_user] = override_current_user
    monkeypatch.setattr(trivia_route, "get_daily_trivia_status_for_user", fake_status)

    response = client.get("/api/v1/trivia/daily")
    assert response.status_code == 200
    assert response.json()["status"] == trivia_status
    assert response.json()["points_earned"] == points


def test_daily_trivia_maps_supabase_error_to_502(monkeypatch):
    async def fake_status(user_id: str):
        raise SupabaseRestError(500, "Test failure.")

    app.dependency_overrides[get_current_user] = override_current_user
    monkeypatch.setattr(trivia_route, "get_daily_trivia_status_for_user", fake_status)

    response = client.get("/api/v1/trivia/daily")
    assert response.status_code == 502


def make_question(position: int, selected_option_id=None) -> TriviaQuestionRead:
    question_id = UUID(int=100 + position)
    return TriviaQuestionRead(
        id=question_id,
        text=f"Question {position}",
        position=position,
        category="team",
        difficulty="easy",
        selected_option_id=selected_option_id,
        options=[
            TriviaOptionRead(id=UUID(int=position * 10 + option), text=f"Option {option}", position=option)
            for option in range(1, 5)
        ],
    )


def make_start(selected_option_id=None) -> TriviaDailyStartRead:
    questions = [make_question(position) for position in range(1, 6)]
    questions[0].selected_option_id = (
        UUID(selected_option_id) if selected_option_id else None
    )
    return TriviaDailyStartRead(
        daily_trivia_id=TEST_TRIVIA_ID,
        trivia_date=date(2026, 10, 14),
        attempt_id=TEST_ATTEMPT_ID,
        status="in_progress",
        question_count=5,
        points_per_correct=20,
        max_points=100,
        questions=questions,
    )


def test_start_returns_five_ordered_questions_without_answer_key(monkeypatch):
    async def fake_start(user_id: str):
        assert user_id == TEST_USER_ID
        return make_start(TEST_OPTION_ID)

    app.dependency_overrides[get_current_user] = override_current_user
    monkeypatch.setattr(trivia_route, "start_daily_trivia_for_user", fake_start)

    response = client.post("/api/v1/trivia/daily/start")
    payload = response.json()
    assert response.status_code == 200
    assert len(payload["questions"]) == 5
    assert [question["position"] for question in payload["questions"]] == [1, 2, 3, 4, 5]
    assert all(len(question["options"]) == 4 for question in payload["questions"])
    assert payload["questions"][0]["selected_option_id"] == TEST_OPTION_ID
    assert "is_correct" not in response.text
    assert "correct_option_id" not in response.text


def test_start_rejects_completed_attempt(monkeypatch):
    async def fake_start(user_id: str):
        raise trivia_service.TriviaRequestError(409, "Daily trivia has already been completed.")

    app.dependency_overrides[get_current_user] = override_current_user
    monkeypatch.setattr(trivia_route, "start_daily_trivia_for_user", fake_start)
    response = client.post("/api/v1/trivia/daily/start")
    assert response.status_code == 409


def test_start_maps_supabase_error(monkeypatch):
    async def fake_start(user_id: str):
        raise SupabaseRestError(500, "failure")

    app.dependency_overrides[get_current_user] = override_current_user
    monkeypatch.setattr(trivia_route, "start_daily_trivia_for_user", fake_start)
    response = client.post("/api/v1/trivia/daily/start")
    assert response.status_code == 502


def test_save_answer_contract(monkeypatch):
    async def fake_save(user_id: str, question_id: str, option_id: str):
        assert (user_id, question_id, option_id) == (TEST_USER_ID, TEST_QUESTION_ID, TEST_OPTION_ID)
        return TriviaAnswerRead(
            question_id=question_id,
            selected_option_id=option_id,
            saved=True,
        )

    app.dependency_overrides[get_current_user] = override_current_user
    monkeypatch.setattr(trivia_route, "save_daily_trivia_answer_for_user", fake_save)
    response = client.put(
        f"/api/v1/trivia/daily/answers/{TEST_QUESTION_ID}",
        json={"selected_option_id": TEST_OPTION_ID},
    )
    assert response.status_code == 200
    assert response.json()["saved"] is True
    assert "is_correct" not in response.text


@pytest.mark.parametrize("status_code", [404, 409, 422])
def test_save_answer_maps_domain_errors(monkeypatch, status_code):
    async def fake_save(*args):
        raise trivia_service.TriviaRequestError(status_code, "invalid answer")

    app.dependency_overrides[get_current_user] = override_current_user
    monkeypatch.setattr(trivia_route, "save_daily_trivia_answer_for_user", fake_save)
    response = client.put(
        f"/api/v1/trivia/daily/answers/{TEST_QUESTION_ID}",
        json={"selected_option_id": TEST_OPTION_ID},
    )
    assert response.status_code == status_code


def make_submit(score=4, already_processed=False) -> TriviaDailySubmitRead:
    review = [
        TriviaQuestionReviewRead(
            question_id=UUID(int=100 + position),
            selected_option_id=UUID(int=position * 10 + 1),
            correct_option_id=UUID(int=position * 10 + 1 if position <= score else position * 10 + 2),
            is_correct=position <= score,
            explanation=f"Explanation {position}",
        )
        for position in range(1, 6)
    ]
    return TriviaDailySubmitRead(
        attempt_id=TEST_ATTEMPT_ID,
        status="completed",
        score=score,
        question_count=5,
        points_earned=score * 20,
        points_balance=200 + score * 20,
        already_processed=already_processed,
        next_available_at=NEXT_AVAILABLE,
        review=review,
    )


@pytest.mark.parametrize("score", [0, 3, 5])
def test_submit_returns_backend_score_points_and_review(monkeypatch, score):
    async def fake_submit(user_id: str):
        assert user_id == TEST_USER_ID
        return make_submit(score)

    app.dependency_overrides[get_current_user] = override_current_user
    monkeypatch.setattr(trivia_route, "submit_daily_trivia_for_user", fake_submit)
    response = client.post("/api/v1/trivia/daily/submit", json={"score": 99, "points_earned": 9999})
    payload = response.json()
    assert response.status_code == 200
    assert payload["score"] == score
    assert payload["points_earned"] == score * 20
    assert len(payload["review"]) == 5
    assert "is_correct" in payload["review"][0]


def test_submit_retry_returns_already_processed(monkeypatch):
    async def fake_submit(user_id: str):
        return make_submit(5, already_processed=True)

    app.dependency_overrides[get_current_user] = override_current_user
    monkeypatch.setattr(trivia_route, "submit_daily_trivia_for_user", fake_submit)
    response = client.post("/api/v1/trivia/daily/submit")
    assert response.json()["already_processed"] is True
    assert response.json()["points_earned"] == 100


@pytest.mark.parametrize(
    "detail",
    [
        "Answer all daily trivia questions before submitting.",
        "Daily trivia attempt has expired.",
        "Daily trivia is not in progress.",
    ],
)
def test_submit_maps_domain_conflicts(monkeypatch, detail):
    async def fake_submit(user_id: str):
        raise trivia_service.TriviaRequestError(409, detail)

    app.dependency_overrides[get_current_user] = override_current_user
    monkeypatch.setattr(trivia_route, "submit_daily_trivia_for_user", fake_submit)
    response = client.post("/api/v1/trivia/daily/submit")
    assert response.status_code == 409
    assert response.json()["detail"] == detail


@pytest.mark.anyio
async def test_start_service_uses_atomic_rpc_and_recovers_progress(monkeypatch):
    questions = [str(UUID(int=100 + position)) for position in range(1, 6)]
    selected = str(UUID(int=11))
    calls = []

    async def fake_request(method, path, *, params=None, json=None, headers=None):
        calls.append((method, path, params, json))
        if path == "rpc/get_or_create_daily_trivia":
            return [{"daily_trivia_id": TEST_TRIVIA_ID, "question_count": 5, "points_per_correct": 20}]
        if path == "rpc/get_or_create_daily_trivia_attempt":
            return [{"attempt_id": TEST_ATTEMPT_ID, "attempt_status": "started", "attempt_score": None}]
        if path == "daily_trivia_questions":
            return [{"question_id": question_id, "position": index + 1} for index, question_id in enumerate(questions)]
        if path == "trivia_questions":
            return [{"id": question_id, "question_text": f"Question {index + 1}", "category": "team", "difficulty": "easy"} for index, question_id in enumerate(questions)]
        if path == "trivia_options":
            return [
                {"id": str(UUID(int=(index + 1) * 10 + option)), "question_id": question_id, "option_text": f"Option {option}", "position": option}
                for index, question_id in enumerate(questions)
                for option in range(1, 5)
            ]
        if path == "trivia_attempt_answers":
            return [{"question_id": questions[0], "selected_option_id": selected}]
        raise AssertionError(path)

    monkeypatch.setattr(trivia_service, "supabase_rest_request", fake_request)
    monkeypatch.setattr(trivia_service, "get_current_trivia_date", lambda: date(2026, 10, 14))
    result = await trivia_service.start_daily_trivia_for_user(TEST_USER_ID)

    assert result.attempt_id == UUID(TEST_ATTEMPT_ID)
    assert result.questions[0].selected_option_id == UUID(selected)
    assert [question.position for question in result.questions] == [1, 2, 3, 4, 5]
    option_call = next(call for call in calls if call[1] == "trivia_options")
    assert "is_correct" not in option_call[2]["select"]


@pytest.mark.anyio
async def test_save_service_replaces_answer_through_rpc(monkeypatch):
    async def fake_current():
        return date(2026, 10, 14), {"daily_trivia_id": TEST_TRIVIA_ID, "question_count": 5, "points_per_correct": 20}

    async def fake_attempt(user_id, trivia_id):
        return {"id": TEST_ATTEMPT_ID, "status": "started", "score": None}

    captured = {}

    async def fake_request(method, path, *, params=None, json=None, headers=None):
        captured.update(json)
        return {"question_id": TEST_QUESTION_ID, "selected_option_id": TEST_OPTION_ID, "saved": True}

    monkeypatch.setattr(trivia_service, "_get_current_daily_trivia", fake_current)
    monkeypatch.setattr(trivia_service, "_get_daily_attempt", fake_attempt)
    monkeypatch.setattr(trivia_service, "supabase_rest_request", fake_request)
    result = await trivia_service.save_daily_trivia_answer_for_user(TEST_USER_ID, TEST_QUESTION_ID, TEST_OPTION_ID)
    assert result.saved is True
    assert captured["p_user_id"] == TEST_USER_ID
    assert "score" not in captured and "points_delta" not in captured


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("database_message", "status_code"),
    [
        ("Question does not belong to the daily trivia.", 404),
        ("Option does not belong to the question.", 422),
    ],
)
async def test_save_service_rejects_foreign_question_or_option(monkeypatch, database_message, status_code):
    async def fake_current():
        return date(2026, 10, 14), {"daily_trivia_id": TEST_TRIVIA_ID, "question_count": 5, "points_per_correct": 20}

    async def fake_attempt(user_id, trivia_id):
        return {"id": TEST_ATTEMPT_ID, "status": "started"}

    async def fake_request(*args, **kwargs):
        raise SupabaseRestError(400, database_message)

    monkeypatch.setattr(trivia_service, "_get_current_daily_trivia", fake_current)
    monkeypatch.setattr(trivia_service, "_get_daily_attempt", fake_attempt)
    monkeypatch.setattr(trivia_service, "supabase_rest_request", fake_request)
    with pytest.raises(trivia_service.TriviaRequestError) as raised:
        await trivia_service.save_daily_trivia_answer_for_user(TEST_USER_ID, TEST_QUESTION_ID, TEST_OPTION_ID)
    assert raised.value.status_code == status_code


@pytest.mark.anyio
async def test_submit_service_does_not_send_client_controlled_score_or_points(monkeypatch):
    async def fake_current():
        return date(2026, 10, 14), {"daily_trivia_id": TEST_TRIVIA_ID, "question_count": 5, "points_per_correct": 20}

    async def fake_attempt(user_id, trivia_id):
        return {"id": TEST_ATTEMPT_ID, "status": "started"}

    async def fake_review(*args):
        return make_submit(4).review

    captured = {}

    async def fake_request(method, path, *, params=None, json=None, headers=None):
        captured.update(json)
        return {
            "score": 4,
            "question_count": 5,
            "points_earned": 80,
            "points_balance": 320,
            "already_processed": False,
        }

    monkeypatch.setattr(trivia_service, "_get_current_daily_trivia", fake_current)
    monkeypatch.setattr(trivia_service, "_get_daily_attempt", fake_attempt)
    monkeypatch.setattr(trivia_service, "_load_daily_review", fake_review)
    monkeypatch.setattr(trivia_service, "supabase_rest_request", fake_request)
    result = await trivia_service.submit_daily_trivia_for_user(TEST_USER_ID)

    assert result.score == 4 and result.points_earned == 80
    assert captured["p_user_id"] == TEST_USER_ID
    assert "score" not in captured and "points_delta" not in captured


@pytest.mark.anyio
async def test_submit_service_requires_all_answers(monkeypatch):
    async def fake_current():
        return date(2026, 10, 14), {"daily_trivia_id": TEST_TRIVIA_ID, "question_count": 5, "points_per_correct": 20}

    async def fake_attempt(user_id, trivia_id):
        return {"id": TEST_ATTEMPT_ID, "status": "started"}

    async def fake_request(*args, **kwargs):
        raise SupabaseRestError(400, "All daily trivia questions must be answered. Expected 5, found 4.")

    monkeypatch.setattr(trivia_service, "_get_current_daily_trivia", fake_current)
    monkeypatch.setattr(trivia_service, "_get_daily_attempt", fake_attempt)
    monkeypatch.setattr(trivia_service, "supabase_rest_request", fake_request)
    with pytest.raises(trivia_service.TriviaRequestError) as raised:
        await trivia_service.submit_daily_trivia_for_user(TEST_USER_ID)
    assert raised.value.status_code == 409
