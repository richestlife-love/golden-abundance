"""Application-wide rate limiter.

Uses ``slowapi`` with default in-memory storage. Per-pod counters are
acceptable for launch scale; migrate to Redis (``storage_uri="redis://..."``)
when the deployment grows beyond a single replica.

Test harness disables the limiter via ``RATE_LIMIT_DISABLED=1`` — the
decorators still wrap the endpoints, but ``limiter.enabled = False``
makes them short-circuit. One dedicated test module re-enables the
limiter to exercise the 429 path.
"""

from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse

from backend.config import get_settings


def _client_key(request: Request) -> str:
    """Prefer the first hop of ``X-Forwarded-For`` so per-client limits
    stay per-client when an L7 load balancer (Railway) terminates the
    connection. TLS terminates at the edge and only the LB prepends this
    header, so we trust its leftmost entry. Falls back to
    ``request.client.host`` when unset (local dev, tests).
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",", 1)[0].strip()
    return get_remote_address(request)


# Module-level singleton. Routers bind ``@limiter.limit(...)`` at import
# time so the instance must exist before any settings are read; the
# enabled flag is reconciled against settings in ``create_app`` (test
# overrides take effect on each boot).
limiter = Limiter(key_func=_client_key, default_limits=[])


def refresh_limiter_from_settings() -> Limiter:
    limiter.enabled = not get_settings().rate_limit_disabled
    return limiter


async def rate_limit_exceeded_handler(_request: Request, exc: Exception) -> JSONResponse:
    headers: dict[str, str] = {}
    # ``RateLimitExceeded.limit`` is set in its ``__init__`` but the
    # class also declares a fallback ``= None``, so narrow explicitly.
    if isinstance(exc, RateLimitExceeded) and exc.limit is not None:
        # Window length is the upper bound on how long until the client's
        # bucket refills — always safe, at worst overestimates.
        headers["Retry-After"] = str(int(exc.limit.limit.get_expiry()))
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
