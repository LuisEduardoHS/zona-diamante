import asyncio

import pytest
from fastapi.testclient import TestClient

from app.db.supabase import SupabaseRestError
from app.main import app
from app.services import cards


def test_public_catalog_reads_only_active_public_tables(monkeypatch):
    async def request(method, path, *, params):
        assert method == "GET"
        assert params["is_active"] == "eq.true"
        if path == "teams":
            return [{"id": 1, "slug": "club", "name": "Club"}]
        assert path == "cards"  # Reading profiles/user_cards here must fail.
        return [dict(id=1, team_id=1, slug="team", name="Team", card_type="team", cost=250,
                     unlock_method="points", image_path=None),
                dict(id=2, team_id=99, slug="inactive-team", name="Hidden", card_type="team",
                     cost=250, unlock_method="points")]

    monkeypatch.setattr(cards, "supabase_rest_request", request)
    response = TestClient(app).get("/api/v1/cards/catalog")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_cards"] == 1
    assert payload["cards"][0]["image_path"] is None
    assert not {"is_owned", "source", "unlocked_at", "user_id", "points_balance"} & payload["cards"][0].keys()
    assert "points_balance" not in payload


def test_private_collection_and_purchase_still_require_identity():
    client = TestClient(app)
    assert client.get("/api/v1/cards").status_code == 401
    assert client.post("/api/v1/cards/1/purchase", headers={"Idempotency-Key": "request"}).status_code == 401


def test_public_catalog_returns_safe_database_error(monkeypatch):
    async def fail(*args, **kwargs):
        raise SupabaseRestError(400, "private infrastructure detail")
    monkeypatch.setattr(cards, "supabase_rest_request", fail)
    response = TestClient(app).get("/api/v1/cards/catalog")
    assert response.status_code == 502
    assert response.json() == {"detail": "Could not retrieve card catalog."}


@pytest.mark.parametrize("malformed", [None, {}, "bad"])
def test_catalog_does_not_turn_malformed_upstream_into_empty_album(monkeypatch, malformed):
    async def request(*args, **kwargs):
        return malformed
    monkeypatch.setattr(cards, "supabase_rest_request", request)
    with pytest.raises(SupabaseRestError):
        asyncio.run(cards.get_card_catalog())
