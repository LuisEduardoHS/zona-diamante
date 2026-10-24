import asyncio

import pytest

from app.services import cards


def test_get_collection_for_user_builds_collection(monkeypatch):
    async def fake_supabase_rest_request(
        method,
        path,
        *,
        params=None,
        json=None,
        headers=None,
    ):
        if path == "profiles":
            return [
                {
                    "points_balance": 750,
                }
            ]

        if path == "teams":
            return [
                {
                    "id": 1,
                    "slug": "sultanes-mty",
                    "name": "Sultanes",
                }
            ]

        if path == "cards":
            return [
                {
                    "id": 10,
                    "team_id": 1,
                    "slug": "sultanes-de-monterrey",
                    "name": "Sultanes de Monterrey",
                    "description": "Carta del equipo.",
                    "image_path": None,
                    "card_type": "team",
                    "cost": 250,
                    "unlock_method": "points",
                },
                {
                    "id": 11,
                    "team_id": 1,
                    "slug": "perro-sultan",
                    "name": "Perro SultÃ¡n",
                    "description": "Mascota del equipo.",
                    "image_path": None,
                    "card_type": "mascot",
                    "cost": 0,
                    "unlock_method": "ar",
                },
            ]

        if path == "user_cards":
            return [
                {
                    "card_id": 10,
                    "source": "points",
                    "unlocked_at": "2026-10-17T00:00:00+00:00",
                }
            ]

        raise AssertionError(
            f"Unexpected Supabase path: {path}"
        )

    monkeypatch.setattr(
        cards,
        "supabase_rest_request",
        fake_supabase_rest_request,
    )

    result = asyncio.run(
        cards.get_collection_for_user(
            "33333333-3333-3333-3333-333333333333"
        )
    )

    assert result.points_balance == 750
    assert result.total_cards == 2
    assert result.owned_cards == 1

    assert result.cards[0].name == "Sultanes de Monterrey"
    assert result.cards[0].is_owned is True
    assert result.cards[0].source == "points"

    assert result.cards[1].name == "Perro SultÃ¡n"
    assert result.cards[1].is_owned is False
    assert result.cards[1].unlock_method == "ar"


def test_purchase_card_calls_rpc(monkeypatch):
    captured = {}

    async def fake_supabase_rest_request(
        method,
        path,
        *,
        params=None,
        json=None,
        headers=None,
    ):
        captured["method"] = method
        captured["path"] = path
        captured["json"] = json

        return {
            "reward_id": "11111111-1111-1111-1111-111111111111",
            "user_id": "33333333-3333-3333-3333-333333333333",
            "card_id": 10,
            "card_name": "Sultanes de Monterrey",
            "card_slug": "sultanes-de-monterrey",
            "points_delta": -250,
            "points_balance": 500,
            "already_processed": False,
        }

    monkeypatch.setattr(
        cards,
        "supabase_rest_request",
        fake_supabase_rest_request,
    )

    result = asyncio.run(
        cards.purchase_card_for_user(
            user_id="33333333-3333-3333-3333-333333333333",
            card_id=10,
            idempotency_key="card-purchase-test",
        )
    )

    assert captured["method"] == "POST"
    assert captured["path"] == "rpc/purchase_card"

    assert captured["json"] == {
        "p_user_id": "33333333-3333-3333-3333-333333333333",
        "p_card_id": 10,
        "p_idempotency_key": "card-purchase-test",
    }

    assert result.card_id == 10
    assert result.points_delta == -250
    assert result.points_balance == 500
    assert result.already_processed is False


def test_purchase_card_rejects_invalid_card_id():
    with pytest.raises(
        ValueError,
        match="card_id must be greater than zero",
    ):
        asyncio.run(
            cards.purchase_card_for_user(
                user_id="33333333-3333-3333-3333-333333333333",
                card_id=0,
                idempotency_key="valid-key",
            )
        )


def test_purchase_card_rejects_empty_idempotency_key():
    with pytest.raises(
        ValueError,
        match="idempotency_key",
    ):
        asyncio.run(
            cards.purchase_card_for_user(
                user_id="33333333-3333-3333-3333-333333333333",
                card_id=10,
                idempotency_key="   ",
            )
        )
