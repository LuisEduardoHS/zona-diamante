import asyncio

from app.core import http_client


def fake_clients(monkeypatch):
    created=[]
    class Client:
        def __init__(self,timeout):self.timeout=timeout;self.closed=False;created.append(self)
        async def __aenter__(self):return self
        async def __aexit__(self,*args):self.closed=True
    monkeypatch.setattr(http_client.httpx,'AsyncClient',Client)
    return created


def test_lifespan_reuses_separate_auth_rest_pools_and_closes(monkeypatch):
    created=fake_clients(monkeypatch)
    async def run():
        async with http_client.http_lifespan(None):
            async with http_client.supabase_http_client(5.0) as a:
                async with http_client.supabase_http_client(5.0) as b:assert a is b
            async with http_client.supabase_http_client(10.0) as rest:assert rest is not a
            assert not any(c.closed for c in created)
        assert all(c.closed for c in created)
        assert not http_client._clients
    asyncio.run(run());assert len(created)==2


def test_standalone_requests_own_and_close_each_connection(monkeypatch):
    created=fake_clients(monkeypatch)
    async def run():
        async with http_client.supabase_http_client(5.0) as a:pass
        async with http_client.supabase_http_client(5.0) as b:assert b is not a
    asyncio.run(run());assert len(created)==2 and all(c.closed for c in created)


def test_pool_is_not_reused_across_event_loops(monkeypatch):
    created=fake_clients(monkeypatch)
    async def run():
        async with http_client.http_lifespan(None):
            async with http_client.supabase_http_client(5.0) as c:return c
    first=asyncio.run(run());second=asyncio.run(run());assert first is not second
    assert len(created)==4 and all(c.closed for c in created)
