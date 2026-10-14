from datetime import date
from uuid import UUID

from fastapi.testclient import TestClient

from app.api.routes import trivia as trivia_route
from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.main import app
from app.schemas.auth import CurrentUser
from app.schemas.trivia import TriviaDailyStatusRead


client = TestClient(app)


TEST_USER_ID = "11111111-1111-1111-1111-111111111111"
TEST_TRIVIA_ID = "22222222-2222-2222-2222-222222222222"


def test_daily_trivia_requires_authentication():
    response = client.get(
        "/api/v1/trivia/daily"
    )

    assert response.status_code == 401

    assert response.json() == {
        "detail": (
            "Invalid or expired authentication token."
        )
    }


def test_daily_trivia_returns_available_status(
    monkeypatch,
):
    async def override_current_user():
        return CurrentUser(
            id=TEST_USER_ID,
            email="test@example.com",
        )

    async def fake_get_daily_trivia_status_for_user(
        user_id: str,
    ):
        assert user_id == TEST_USER_ID

        return TriviaDailyStatusRead(
            daily_trivia_id=UUID(TEST_TRIVIA_ID),
            trivia_date=date(2026, 10, 14),
            status="available",
            question_count=5,
            points_per_correct=20,
            max_points=100,
            attempt_id=None,
            score=None,
        )

    app.dependency_overrides[
        get_current_user
    ] = override_current_user

    monkeypatch.setattr(
        trivia_route,
        "get_daily_trivia_status_for_user",
        fake_get_daily_trivia_status_for_user,
    )

    try:
        response = client.get(
            "/api/v1/trivia/daily"
        )

        assert response.status_code == 200

        assert response.json() == {
            "daily_trivia_id": TEST_TRIVIA_ID,
            "trivia_date": "2026-10-14",
            "status": "available",
            "question_count": 5,
            "points_per_correct": 20,
            "max_points": 100,
            "attempt_id": None,
            "score": None,
        }

    finally:
        app.dependency_overrides.clear()


def test_daily_trivia_maps_supabase_error_to_502(
    monkeypatch,
):
    async def override_current_user():
        return CurrentUser(
            id=TEST_USER_ID,
            email="test@example.com",
        )

    async def fake_get_daily_trivia_status_for_user(
        user_id: str,
    ):
        raise SupabaseRestError(
            500,
            "Test failure.",
        )

    app.dependency_overrides[
        get_current_user
    ] = override_current_user

    monkeypatch.setattr(
        trivia_route,
        "get_daily_trivia_status_for_user",
        fake_get_daily_trivia_status_for_user,
    )

    try:
        response = client.get(
            "/api/v1/trivia/daily"
        )

        assert response.status_code == 502

        assert response.json() == {
            "detail": (
                "Could not retrieve daily trivia."
            )
        }

    finally:
        app.dependency_overrides.clear()