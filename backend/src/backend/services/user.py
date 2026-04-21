"""User service: upsert-by-Supabase-identity + DB→contract mapping.

``UserRow.id`` holds Supabase's ``auth.users.id`` UUID. ``current_user``
calls ``upsert_user_by_supabase_identity`` on its first request for a
given ``sub`` so freshly-signed-up users get an app-side row the moment
they hit any authed endpoint.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import User as ContractUser
from backend.db.models import UserRow
from backend.services.display_id import generate_user_display_id


async def upsert_user_by_supabase_identity(
    session: AsyncSession,
    *,
    auth_user_id: UUID,
    email: str,
) -> UserRow:
    """Return the existing ``UserRow`` for ``auth_user_id`` or create one.

    Caller is responsible for committing — this function only ``flush()``es
    so the new row has relationships but sits in the session's identity
    map.

    Two failure modes surface as ``IntegrityError`` from ``flush()`` and
    are **not** handled here (see the plan's "Known deferrals" section):

    - Concurrent first-sign-in requests for the same ``auth_user_id``
      racing on unique ``display_id`` generation.
    - A Supabase user deleted + recreated (same email, new ``sub``)
      colliding with the existing ``UserRow.email`` unique constraint.
    """
    email = email.lower()
    existing = await session.get(UserRow, auth_user_id)
    if existing is not None:
        return existing
    display_id = await generate_user_display_id(session, email=email)
    row = UserRow(
        id=auth_user_id,
        display_id=display_id,
        email=email,
        profile_complete=False,
    )
    session.add(row)
    await session.flush()
    return row


def derive_user_name(row: UserRow) -> str:
    """Display name fallback chain: zh_name → nickname → email local-part."""
    if row.zh_name:
        return row.zh_name
    if row.nickname:
        return row.nickname
    return row.email.split("@", 1)[0]


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
