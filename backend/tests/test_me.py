from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app
from app.schemas.auth import CurrentUser


client = TestClient(app)


def test_me_requires_authentication():
    response = client.get("/api/v1/me")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Invalid or expired authentication token."
    }


def test_me_returns_authenticated_user():
    async def override_current_user():
        return CurrentUser(
            id="11111111-1111-1111-1111-111111111111",
            email="test@example.com",
        )

    app.dependency_overrides[get_current_user] = override_current_user

    try:
        response = client.get("/api/v1/me")

        assert response.status_code == 200
        assert response.json() == {
            "id": "11111111-1111-1111-1111-111111111111",
            "email": "test@example.com",
        }
    finally:
        app.dependency_overrides.clear()