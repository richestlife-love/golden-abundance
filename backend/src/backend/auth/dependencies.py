"""FastAPI dependency that resolves the current UserRow from a Bearer
token. Raises 401 on missing, malformed, expired, or JWKS-mismatched
tokens. On first authed request for a never-seen Supabase ``sub``, the
matching ``UserRow`` is upserted so downstream routes always have an
app-side row to work against.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.supabase import verify_supabase_jwt
from backend.db.models import UserRow
from backend.db.session import get_session
from backend.services.user import upsert_user_by_supabase_identity

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
        claims = verify_supabase_jwt(token)
    except ValueError as exc:
        raise _UNAUTHORIZED from exc

    user = await session.get(UserRow, claims.sub)
    if user is not None:
        return user

    try:
        user = await upsert_user_by_supabase_identity(
            session,
            auth_user_id=claims.sub,
            email=str(claims.email),
        )
        # Commit inside the dep so a freshly-materialized UserRow persists
        # even if the downstream handler fails. This is the only commit
        # current_user performs; the cached-user path is read-only.
        await session.commit()
    except IntegrityError:
        # Concurrent first-sign-in: another request for this sub committed
        # first, so our insert hit a unique constraint. Recover by
        # re-fetching the row the winning request wrote. If it still isn't
        # there the IntegrityError came from a different constraint (e.g.
        # the stale-email collision called out in 6a's Known Deferrals);
        # surface it rather than swallow.
        await session.rollback()
        user = await session.get(UserRow, claims.sub)
        if user is None:
            raise
    return user
