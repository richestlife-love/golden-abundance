"""User service: upsert-by-Supabase-identity + DB→contract mapping.

``UserRow.id`` holds Supabase's ``auth.users.id`` UUID. ``current_user``
calls ``upsert_user_by_supabase_identity`` on its first request for a
given ``sub`` so freshly-signed-up users get an app-side row the moment
they hit any authed endpoint.
"""

from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import User as ContractUser
from backend.db.models import UserRow
from backend.services.display_id import generate_user_display_id

# Max retries for the display_id collision race (M2). Two concurrent
# first-sign-ins with colliding email local-parts can both pick the
# same candidate; the loser rolls back the savepoint and picks again
# from a now-stale set. Three attempts is enough in practice — after
# the first retry the winner's row is visible, so the candidate search
# skips it. Any further collision is an actual email duplicate, which
# retrying won't fix.
_UPSERT_MAX_ATTEMPTS = 3


async def upsert_user_by_supabase_identity(
    session: AsyncSession,
    *,
    auth_user_id: UUID,
    email: str,
) -> UserRow:
    """Return the existing ``UserRow`` for ``auth_user_id`` or create one.

    Caller is responsible for committing — this function only
    ``flush()``es (inside a savepoint) so the new row has relationships
    but sits in the session's identity map.

    Concurrent first-sign-ins are handled internally:

    - **PK collision** (two requests for the same ``sub``): the loser's
      savepoint rolls back, a re-fetch by PK finds the winner's row, and
      that row is returned.
    - **display_id collision** (two different ``sub``s whose emails
      resolve to the same candidate): the loser's savepoint rolls back
      and the retry re-generates a candidate against the now-committed
      winner, picking a fresh suffix.

    Still not handled: a Supabase user deleted + recreated (same email,
    new ``sub``) colliding with the existing ``UserRow.email`` unique
    constraint. That one propagates as ``IntegrityError`` after
    ``_UPSERT_MAX_ATTEMPTS`` — retry can't help because the email is
    the same each time.
    """
    email = email.lower()
    existing = await session.get(UserRow, auth_user_id)
    if existing is not None:
        return existing

    last_exc: IntegrityError | None = None
    for _attempt in range(_UPSERT_MAX_ATTEMPTS):
        display_id = await generate_user_display_id(session, email=email)
        row = UserRow(
            id=auth_user_id,
            display_id=display_id,
            email=email,
            profile_complete=False,
        )
        try:
            async with session.begin_nested():
                session.add(row)
                await session.flush()
        except IntegrityError as exc:
            last_exc = exc
            # Was this the concurrent-same-sub race? If so return the
            # winner's row. Otherwise (display_id or email clash) loop
            # and generate a fresh candidate.
            winner = await session.get(UserRow, auth_user_id)
            if winner is not None:
                return winner
            continue
        else:
            return row

    assert last_exc is not None  # unreachable — loop body either returns or raises
    raise last_exc


def derive_user_name(row: UserRow) -> str:
    """Display name fallback chain: zh_name → nickname → ``U{display_id}``.

    The final fallback used to be the email local-part, which leaked the
    user's email identity (often their real name) to teammates via
    ``UserRef.name``. Returning the opaque ``U…`` id instead protects
    that without breaking any code that expects a non-empty string (L7).
    """
    if row.zh_name:
        return row.zh_name
    if row.nickname:
        return row.nickname
    return row.display_id


def row_to_contract_user(row: UserRow) -> ContractUser:
    return ContractUser(
        id=row.id,
        display_id=row.display_id,
        email=row.email,
        zh_name=row.zh_name,
        en_name=row.en_name,
        nickname=row.nickname,
        name=derive_user_name(row),
        phone=row.phone,
        phone_code=row.phone_code,
        line_id=row.line_id,
        telegram_id=row.telegram_id,
        country=row.country,
        location=row.location,
        avatar_url=row.avatar_url,
        profile_complete=row.profile_complete,
        created_at=row.created_at,
    )
