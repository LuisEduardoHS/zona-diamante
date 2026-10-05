from fastapi.testclient import TestClient

from app.core import security
from app.main import app


client = TestClient(app)


class FakeResponse:
    def __init__(self, status_code: int, data: dict):
        self.status_code = status_code
        self._data = data

    def json(self):
        return self._data


def configure_fake_supabase(
    monkeypatch,
    *,
    status_code: int,
    data: dict,
):
    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(
            self,
            exc_type,
            exc,
            traceback,
        ):
            return False

        async def get(
            self,
            url,
            headers=None,
        ):
            return FakeResponse(
                status_code,
                data,
            )

    monkeypatch.setattr(
        security.settings,
        "supabase_url",
        "https://example.supabase.co",
    )

    monkeypatch.setattr(
        security.settings,
        "supabase_publishable_key",
        "test-publishable-key",
    )

    monkeypatch.setattr(
        security.httpx,
        "AsyncClient",
        FakeAsyncClient,
    )


def test_valid_token_returns_current_user(monkeypatch):
    configure_fake_supabase(
        monkeypatch,
        status_code=200,
        data={
            "id": "11111111-1111-1111-1111-111111111111",
            "email": "test@example.com",
        },
    )

    response = client.get(
        "/api/v1/me",
        headers={
            "Authorization": "Bearer valid-test-token",
        },
    )

    assert response.status_code == 200

    assert response.json() == {
        "id": "11111111-1111-1111-1111-111111111111",
        "email": "test@example.com",
    }


def test_missing_token_returns_401():
    response = client.get(
        "/api/v1/me",
    )

    assert response.status_code == 401

    assert response.json() == {
        "detail": "Invalid or expired authentication token."
    }


def test_expired_token_returns_401(monkeypatch):
    configure_fake_supabase(
        monkeypatch,
        status_code=401,
        data={
            "message": "JWT expired",
        },
    )

    response = client.get(
        "/api/v1/me",
        headers={
            "Authorization": "Bearer expired-test-token",
        },
    )

    assert response.status_code == 401

    assert response.json() == {
        "detail": "Invalid or expired authentication token."
    }


def test_tampered_token_returns_401(monkeypatch):
    configure_fake_supabase(
        monkeypatch,
        status_code=401,
        data={
            "message": "Invalid JWT",
        },
    )

    response = client.get(
        "/api/v1/me",
        headers={
            "Authorization": "Bearer manipulated-test-token",
        },
    )

    assert response.status_code == 401

    assert response.json() == {
        "detail": "Invalid or expired authentication token."
    }