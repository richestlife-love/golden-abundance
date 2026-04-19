"""FastAPI dependency that resolves the current UserRow from a Bearer
token. Raises 401 on missing, malformed, expired, or unknown-user tokens.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.jwt import decode_token
from backend.db.models import UserRow
from backend.db.session import get_session

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Missing or invalid bearer token",
    headers={"WWW-Authenticate": "Bearer"},
)


async def current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_session),
) -> UserRow:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _UNAUTHORIZED
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = decode_token(token)
    except ValueError as exc:
        raise _UNAUTHORIZED from exc
    try:
        user_id = UUID(claims["sub"])
    except (KeyError, ValueError) as exc:
        raise _UNAUTHORIZED from exc
    user = await session.get(UserRow, user_id)
    if user is None:
        raise _UNAUTHORIZED
    return user
