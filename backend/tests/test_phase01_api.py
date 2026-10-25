import asyncio

import pytest
from fastapi.testclient import TestClient

from app.api.routes import cards as cards_route
from app.core.security import get_current_user
from app.db.supabase import SupabaseRestError
from app.main import app
from app.schemas.auth import CurrentUser
from app.schemas.card import CardPurchaseResult
from app.services import rewards, trivia


USER = "10000000-0000-4000-8000-000000000001"
FOREIGN_USER = "10000000-0000-4000-8000-000000000002"
client = TestClient(app)


@pytest.fixture(autouse=True)
def authenticated_user():
    async def current_user():
        return CurrentUser(id=USER, email="phase01@example.invalid")

    app.dependency_overrides[get_current_user] = current_user
    yield
    app.dependency_overrides.clear()


def test_purchase_uses_authenticated_identity_and_keeps_client_request_contract(monkeypatch):
    captured = {}

    async def purchase(**kwargs):
        captured.update(kwargs)
        return CardPurchaseResult(
            reward_id="30000000-0000-4000-8000-000000000001",
            user_id=USER, card_id=10, card_name="Team", card_slug="team",
            points_delta=-250, points_balance=750, already_processed=False,
        )

    monkeypatch.setattr(cards_route, "purchase_card_for_user", purchase)
    response = client.post(
        "/api/v1/cards/10/purchase",
        headers={"Idempotency-Key": "daily-trivia:client-controlled"},
        json={"user_id": FOREIGN_USER, "cost": 0, "points_delta": 99999},
    )
    assert response.status_code == 200
    assert captured == {
        "user_id": USER, "card_id": 10,
        "idempotency_key": "daily-trivia:client-controlled",
    }
    assert response.json()["points_balance"] == 750
    assert "idempotency_key" not in response.json()


@pytest.mark.parametrize("key", [None, "x" * 129])
def test_purchase_header_remains_required_and_bounded(key):
    headers = {} if key is None else {"Idempotency-Key": key}
    assert client.post("/api/v1/cards/10/purchase", headers=headers).status_code == 422


def test_purchase_without_session_is_denied():
    app.dependency_overrides.clear()
    assert client.post(
        "/api/v1/cards/10/purchase", headers={"Idempotency-Key": "request"}
    ).status_code == 401


@pytest.mark.parametrize(
    ("database_message", "status_code", "public_message"),
    [
        ("Idempotency key belongs to another operation.", 409,
         "Idempotency key belongs to another operation."),
        ("Economic operation state is inconsistent.", 409,
         "The purchase could not be confirmed. Please contact support."),
        ("internal detail about another account", 502, "Could not purchase card."),
    ],
)
def test_purchase_errors_do_not_expose_internal_identity(
    monkeypatch, database_message, status_code, public_message
):
    async def fail(**kwargs):
        raise SupabaseRestError(400, database_message)

    monkeypatch.setattr(cards_route, "purchase_card_for_user", fail)
    response = client.post("/api/v1/cards/10/purchase", headers={"Idempotency-Key": "request"})
    assert response.status_code == status_code
    assert response.json() == {"detail": public_message}


@pytest.mark.parametrize("message", [
    "Idempotency key belongs to another operation.",
    "Economic operation state is inconsistent.",
])
def test_trivia_integrity_conflicts_are_mapped_to_safe_domain_errors(message):
    with pytest.raises(trivia.TriviaRequestError) as raised:
        trivia._raise_known_rpc_error(SupabaseRestError(400, message))
    assert raised.value.status_code == 409
    assert "Daily trivia completion" in raised.value.detail


def test_rewards_are_filtered_by_authenticated_user_and_limit(monkeypatch):
    captured = {}

    async def request(method, path, **kwargs):
        captured.update(method=method, path=path, **kwargs)
        return []

    monkeypatch.setattr(rewards, "supabase_rest_request", request)
    assert asyncio.run(rewards.get_rewards_for_user(USER, limit=10000)) == []
    assert captured["params"]["user_id"] == f"eq.{USER}"
    assert captured["params"]["limit"] == "100"
