import asyncio

import pytest

from app.services import rewards


def test_complete_attempt_transaction_calls_rpc(monkeypatch):
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
            "attempt_id": "22222222-2222-2222-2222-222222222222",
            "user_id": "33333333-3333-3333-3333-333333333333",
            "points_delta": 0,
            "points_balance": 0,
            "already_processed": False,
        }

    monkeypatch.setattr(
        rewards,
        "supabase_rest_request",
        fake_supabase_rest_request,
    )

    result = asyncio.run(
        rewards.complete_attempt_transaction(
            user_id="33333333-3333-3333-3333-333333333333",
            attempt_id="22222222-2222-2222-2222-222222222222",
            event_type="phase3_test",
            idempotency_key="phase3-test-key",
            score=0,
            points_delta=0,
            metadata={"test": True},
        )
    )

    assert captured["method"] == "POST"
    assert captured["path"] == "rpc/complete_activity_attempt"

    assert captured["json"]["p_user_id"] == (
        "33333333-3333-3333-3333-333333333333"
    )

    assert captured["json"]["p_idempotency_key"] == (
        "phase3-test-key"
    )

    assert result.points_delta == 0
    assert result.points_balance == 0
    assert result.already_processed is False

def test_complete_attempt_rejects_empty_idempotency_key():
    with pytest.raises(ValueError):
        asyncio.run(
            rewards.complete_attempt_transaction(
                user_id="33333333-3333-3333-3333-333333333333",
                attempt_id="22222222-2222-2222-2222-222222222222",
                event_type="phase3_test",
                idempotency_key="   ",
            )
        )


def test_complete_attempt_rejects_long_event_type():
    with pytest.raises(ValueError):
        asyncio.run(
            rewards.complete_attempt_transaction(
                user_id="33333333-3333-3333-3333-333333333333",
                attempt_id="22222222-2222-2222-2222-222222222222",
                event_type="x" * 65,
                idempotency_key="valid-key",
            )
        )