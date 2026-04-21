from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import UserRow


async def test_insert_and_read_user(session: AsyncSession) -> None:
    user = UserRow(
        id=uuid4(),
        display_id="UTEST1",
        email="roundtrip@example.com",
        profile_complete=False,
    )
    session.add(user)
    await session.commit()

    result = await session.execute(select(UserRow).where(UserRow.email == "roundtrip@example.com"))
    fetched = result.scalar_one()
    assert fetched.display_id == "UTEST1"
    assert fetched.profile_complete is False
