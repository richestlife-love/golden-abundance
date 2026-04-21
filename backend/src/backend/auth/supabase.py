"""Supabase JWKS-based JWT verification.

Supabase signs access tokens with an asymmetric RS256 key. The public
key(s) are served at ``<SUPABASE_URL>/auth/v1/.well-known/jwks.json``.
PyJWT's ``PyJWKClient`` fetches and caches the JWKS in-process so
verification is cheap after the first call.

All verification failures surface as ``ValueError`` so callers (the
``current_user`` dep) don't import PyJWT's exception hierarchy.
"""

from functools import lru_cache

import jwt as pyjwt
from jwt import PyJWKClient

from backend.config import get_settings
from backend.contract.auth import SupabaseClaims

_ALGORITHMS = ["RS256"]


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    return PyJWKClient(
        get_settings().supabase_jwks_url,
        cache_keys=True,
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
    except pyjwt.PyJWTError as exc:
        raise ValueError(str(exc)) from exc
    except Exception as exc:  # PyJWKClient raises bare RuntimeError on malformed headers
        raise ValueError(str(exc)) from exc
    return SupabaseClaims.model_validate(raw)
