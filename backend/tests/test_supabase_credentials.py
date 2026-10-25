import asyncio

import httpx
import pytest

from app.db import supabase


@pytest.mark.parametrize(("key", "bearer"), [
    ("eyJheader.payload.signature", True),
    ("sb_secret_test_opaque_key", False),
])
def test_rest_supports_legacy_jwt_and_modern_secret_keys(monkeypatch, key, bearer):
    monkeypatch.setattr(supabase.settings, "supabase_url", "http://127.0.0.1:54321")
    monkeypatch.setattr(supabase.settings, "supabase_secret_key", key)
    original_client = httpx.AsyncClient
    captured = []

    def respond(request):
        captured.append(request)
        return httpx.Response(200, json={"ok": True})

    transport = httpx.MockTransport(respond)
    monkeypatch.setattr(supabase.httpx, "AsyncClient",
        lambda **kwargs: original_client(transport=transport, **kwargs))
    assert asyncio.run(supabase.supabase_rest_request("POST", "rpc/start_game_attempt", json={})) == {"ok": True}
    assert captured[0].headers["apikey"] == key
    if bearer:
        assert captured[0].headers["Authorization"] == f"Bearer {key}"
    else:
        assert "Authorization" not in captured[0].headers
