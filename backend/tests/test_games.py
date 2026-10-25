import asyncio

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.main import app
from app.schemas.auth import CurrentUser
from app.services import games


USER = "40000000-0000-4000-8000-000000000001"
GAME = "40000000-0000-4000-8000-000000000002"
client = TestClient(app)


@pytest.fixture(autouse=True)
def authenticated():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER)
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def requests(monkeypatch):
    captured = []

    async def request(method, path, **kwargs):
        captured.append((method, path, kwargs))
        row = {"id": GAME, "game_state": "active", "game_revision": 0,
               "started_at": "2026-10-25T12:00:00Z", "completed_at": None,
               "game_request_key": "private", "metadata": {"win": True}}
        return [row] if method == "GET" else row

    monkeypatch.setattr(games, "supabase_rest_request", request)
    return captured


@pytest.mark.parametrize(("method", "path", "body"), [
    ("POST", "/api/v1/games", {}),
    ("GET", f"/api/v1/games/{GAME}", None),
    ("POST", f"/api/v1/games/{GAME}/transitions", {"action": "pause", "expected_revision": 0}),
])
def test_authentication_required(method, path, body):
    app.dependency_overrides.clear()
    assert client.request(method, path, json=body, headers={"Idempotency-Key": "key"}).status_code == 401


def test_start_and_restart_use_server_identity_and_rpc(requests):
    for body in ({}, {"restart_of": GAME}):
        response = client.post("/api/v1/games", json=body, headers={"Idempotency-Key": " key "})
        assert response.status_code == 200
        assert response.json()["rewards_enabled"] is False
        assert "metadata" not in response.json()
        assert "game_request_key" not in response.json()
        assert requests[-1] == ("POST", "rpc/start_game_attempt", {"json": {
            "p_user_id": USER, "p_request_key": "key", "p_restart_of": body.get("restart_of"),
        }})


@pytest.mark.parametrize("key", [None, "", " ", "x" * 129])
def test_start_key_required_and_bounded(key, requests):
    assert client.post("/api/v1/games", json={}, headers={} if key is None else {"Idempotency-Key": key}).status_code == 422
    assert not requests


@pytest.mark.parametrize("body", [
    {"user_id": USER}, {"win": True}, {"score": 100}, {"points_delta": 1000},
    {"metadata": {"validated": True}}, {"restart_of": "invalid"}, {"completed": True},
])
def test_start_rejects_client_results_and_identity(body, requests):
    assert client.post("/api/v1/games", json=body, headers={"Idempotency-Key": "key"}).status_code == 422
    assert not requests


def test_get_filters_owner_and_excludes_generic_attempts(requests):
    assert client.get(f"/api/v1/games/{GAME}").status_code == 200
    assert requests[0][2]["params"] == {
        "select": games.GAME_SELECT, "id": f"eq.{GAME}", "user_id": f"eq.{USER}",
        "activity_type": "eq.game", "game_state": "not.is.null", "limit": "1",
    }


def test_missing_and_foreign_game_are_indistinguishable(monkeypatch):
    async def missing(*args, **kwargs):
        return []
    monkeypatch.setattr(games, "supabase_rest_request", missing)
    assert client.get(f"/api/v1/games/{GAME}").json() == {"detail": "Game not found."}
    assert client.get(f"/api/v1/games/{GAME}").status_code == 404


@pytest.mark.parametrize("action", ["pause", "resume", "abandon"])
def test_transition_uses_owner_and_revision(action, requests):
    response = client.post(f"/api/v1/games/{GAME}/transitions", json={"action": action, "expected_revision": 2})
    assert response.status_code == 200
    assert requests[0] == ("POST", "rpc/transition_game_attempt", {"json": {
        "p_user_id": USER, "p_attempt_id": GAME, "p_action": action, "p_expected_revision": 2,
    }})


@pytest.mark.parametrize("body", [
    {"action": "win", "expected_revision": 0}, {"action": "complete", "expected_revision": 0},
    {"action": "pause", "expected_revision": -1}, {"action": "pause", "expected_revision": True},
    {"action": "pause", "expected_revision": "0"}, {"action": "pause"},
    {"action": "pause", "expected_revision": 2147483647},
    {"action": "abandon", "expected_revision": 0, "score": 100},
])
def test_invalid_transitions_never_reach_database(body, requests):
    assert client.post(f"/api/v1/games/{GAME}/transitions", json=body).status_code == 422
    assert not requests


@pytest.mark.parametrize(("message", "code"), [
    ("Game not found.", 404), ("Profile not found.", 404),
    ("Game transition conflict.", 409), ("Game already restarted.", 409),
    ("internal SQL and user details", 502),
])
def test_database_errors_are_safe(monkeypatch, message, code):
    async def fail(*args, **kwargs):
        raise SupabaseRestError(400, message)
    monkeypatch.setattr(games, "supabase_rest_request", fail)
    for path, body, headers in [
        ("/api/v1/games", {}, {"Idempotency-Key": "key"}),
        (f"/api/v1/games/{GAME}/transitions", {"action": "abandon", "expected_revision": 0}, {}),
    ]:
        response = client.post(path, json=body, headers=headers)
        assert response.status_code == code
        assert "internal" not in response.text
    assert client.get(f"/api/v1/games/{GAME}").status_code == code


@pytest.mark.parametrize("suffix", ["complete", "finish", "rewards"])
def test_no_client_claim_completion_endpoint(suffix, requests):
    assert client.post(f"/api/v1/games/{GAME}/{suffix}", json={"win": True, "score": 100}).status_code == 404
    assert not requests


def test_invalid_uuid_rejected(requests):
    assert client.get("/api/v1/games/not-an-id").status_code == 422
    assert not requests


def test_service_key_validation_also_applies_outside_http():
    with pytest.raises(games.InvalidGameKey):
        asyncio.run(games.start_game(USER, " ", None))
