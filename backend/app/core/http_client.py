"""Reuse TLS connections per ASGI event loop; never cache tokens or identities."""
import asyncio
from contextlib import asynccontextmanager

import httpx

_clients: dict[asyncio.AbstractEventLoop, dict[float, httpx.AsyncClient]] = {}


@asynccontextmanager
async def http_lifespan(_app):
    loop = asyncio.get_running_loop()
    async with httpx.AsyncClient(timeout=5.0) as auth, httpx.AsyncClient(timeout=10.0) as rest:
        _clients[loop] = {5.0: auth, 10.0: rest}
        try:
            yield
        finally:
            _clients.pop(loop, None)


@asynccontextmanager
async def supabase_http_client(timeout: float):
    shared = _clients.get(asyncio.get_running_loop(), {}).get(timeout)
    if shared is not None:
        yield shared
    else:
        # Standalone services/ASGI tests without lifespan retain safe ownership.
        async with httpx.AsyncClient(timeout=timeout) as temporary:
            yield temporary
