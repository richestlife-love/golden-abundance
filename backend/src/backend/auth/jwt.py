"""HS256 JWT encode/decode using PyJWT.

`ValueError` is raised for any invalid/expired/malformed token so
callers don't need to import PyJWT exception hierarchy.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt as pyjwt

from backend.config import get_settings

_ALGORITHM = "HS256"


def encode_token(*, user_id: UUID, email: str, ttl: timedelta | None = None) -> str:
    settings = get_settings()
    if ttl is None:
        ttl = timedelta(seconds=settings.jwt_ttl_seconds)
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
    }
    return pyjwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return pyjwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])
    except pyjwt.PyJWTError as exc:
        raise ValueError(str(exc)) from exc
