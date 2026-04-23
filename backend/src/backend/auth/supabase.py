"""Supabase JWKS-based JWT verification.

Supabase signs access tokens with an asymmetric key (RS256 or ES256 —
newer projects default to ES256 via the JWT Signing Keys feature). The
public key(s) are served at ``<SUPABASE_URL>/auth/v1/.well-known/jwks.json``.
PyJWT's ``PyJWKClient`` fetches and caches the JWKS in-process so
verification is cheap after the first call.

All verification failures surface as ``ValueError`` so callers (the
``current_user`` dep) don't import PyJWT's exception hierarchy.
"""

import logging
from functools import lru_cache

import jwt as pyjwt
from jwt import PyJWKClient

from backend.config import get_settings
from backend.contract.auth import SupabaseClaims

_ALGORITHMS = ["RS256", "ES256"]

_log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    # `lifespan` governs the JWK-set cache so we refetch at most hourly.
    # `cache_keys` is intentionally left off (default False): it adds an
    # unbounded-TTL lru_cache on per-kid lookups, which would keep
    # accepting tokens signed by a revoked kid until the worker restarted.
    # The JWK-set cache alone makes the per-kid lookup a dict access.
    return PyJWKClient(
        get_settings().supabase_jwks_url,
        lifespan=3600,
    )


def verify_supabase_jwt(token: str) -> SupabaseClaims:
    settings = get_settings()
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token).key
        raw = pyjwt.decode(
            token,
            signing_key,
            algorithms=_ALGORITHMS,
            audience=settings.supabase_jwt_aud,
            issuer=settings.supabase_issuer,
        )
    except (pyjwt.PyJWTError, RuntimeError) as exc:
        # RuntimeError covers PyJWKClient raising bare on malformed headers.
        # Diagnostic — the 401 surfaced to the client collapses every
        # failure mode into one message, so we log the real exception type
        # + message here for Railway to pick up. Remove once sign-in is
        # stable in prod.
        _log.warning(
            "supabase jwt verify failed: %s: %s",
            type(exc).__name__,
            exc,
        )
        raise ValueError(str(exc)) from exc
    return SupabaseClaims.model_validate(raw)
