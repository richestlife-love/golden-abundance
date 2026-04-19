"""User service: upsert-by-email on sign-in + DB→contract mapping.

Note: ``profile_complete`` stays ``False`` until ``POST /me/profile``
runs. That flow is in Section D — this module only covers sign-in
creation.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import User as ContractUser
from backend.db.models import UserRow
from backend.services.display_id import generate_user_display_id


async def upsert_user_by_email(session: AsyncSession, *, email: str) -> UserRow:
    """Upsert a UserRow by email; returns existing row or creates a new one.

    Caller is responsible for committing — this function only ``flush()``es
    so the new row has a PK. Concurrent sign-ups with the same email can
    still raise ``IntegrityError`` on the unique email/display_id columns;
    the race is documented in ``display_id.py`` and deferred to Phase 6.
    """
    # Belt-and-braces: callers should pre-normalize but we do it here too.
    email = email.lower()
    existing = await session.execute(select(UserRow).where(UserRow.email == email))  # ty: ignore[invalid-argument-type]
    row = existing.scalar_one_or_none()
    if row is not None:
        return row
    display_id = await generate_user_display_id(session, email=email)
    row = UserRow(display_id=display_id, email=email, profile_complete=False)  # ty: ignore[missing-argument]
    session.add(row)
    await session.flush()  # give row an id without committing
    return row


def _derive_name(row: UserRow) -> str:
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
        name=_derive_name(row),
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
