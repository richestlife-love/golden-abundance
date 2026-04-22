"""Application-wide rate limiter (H1).

Uses ``slowapi`` with the default in-memory storage. Per-pod counters
are acceptable for launch scale; migrate to Redis storage
(``storage_uri="redis://..."``) when the deployment grows beyond a
single replica.

Test harness disables the limiter via ``RATE_LIMIT_DISABLED=1`` — the
decorators still wrap the endpoints, but ``limiter.enabled = False``
makes them short-circuit. One dedicated test module re-enables the
limiter to exercise the 429 path.
"""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse

from backend.config import get_settings

# Module-level singleton. Routers import this and use ``@limiter.limit(...)``
# at decoration time. ``create_app()`` reconciles ``enabled`` against the
# current settings on every boot so test overrides take effect even
# though the instance is shared across ``create_app`` calls.
limiter = Limiter(key_func=get_remote_address, default_limits=[])


def refresh_limiter_from_settings() -> Limiter:
    """Sync ``limiter.enabled`` with ``Settings.rate_limit_disabled``.

    Called from ``create_app`` after ``get_settings`` has been cleared
    by the test fixture, so tests that change ``RATE_LIMIT_DISABLED``
    via ``monkeypatch.setenv`` observe the new value.
    """
    limiter.enabled = not get_settings().rate_limit_disabled
    return limiter


async def rate_limit_exceeded_handler(_request: Request, exc: Exception) -> JSONResponse:
    retry_after = getattr(exc, "retry_after", None)
    headers = {"Retry-After": str(int(retry_after))} if retry_after else {}
    return JSONResponse(
        status_code=429,
        content={"detail": "rate limit exceeded"},
        headers=headers,
    )


__all__ = [
    "RateLimitExceeded",
    "limiter",
    "rate_limit_exceeded_handler",
    "refresh_limiter_from_settings",
]
