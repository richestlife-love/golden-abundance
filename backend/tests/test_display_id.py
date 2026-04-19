import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import UserRow
from backend.services.display_id import generate_team_display_id, generate_user_display_id


async def test_user_display_id_from_email(session: AsyncSession) -> None:
    did = await generate_user_display_id(session, email="jetkan@example.com")
    assert did.startswith("U")
    assert 4 <= len(did) <= 8


async def test_user_display_id_collision_suffix(session: AsyncSession) -> None:
    session.add(UserRow(display_id="UJET", email="a@example.com"))
    await session.commit()
    did = await generate_user_display_id(session, email="jet@other.example.com")
    assert did != "UJET"
    assert did.startswith("UJET")


async def test_team_display_id_from_user(session: AsyncSession) -> None:
    did = generate_team_display_id(user_display_id="UJETKAN", used=set())
    assert did == "T-JETKAN"


async def test_team_display_id_collision(session: AsyncSession) -> None:
    did = generate_team_display_id(user_display_id="UJETKAN", used={"T-JETKAN"})
    assert did != "T-JETKAN"
    assert did.startswith("T-JETKAN")


async def test_user_display_id_runs_out_after_100_collisions(
    session: AsyncSession,
) -> None:
    """The 100-attempt cap must RuntimeError cleanly, not corrupt data."""
    from backend.db.models import UserRow
    from backend.services.display_id import generate_user_display_id

    base_taken = ["UJET"] + [f"UJET{n:02d}" for n in range(100)]
    for did in base_taken:
        session.add(UserRow(display_id=did, email=f"{did}@example.com"))
    await session.commit()

    with pytest.raises(RuntimeError, match="Could not allocate|display_id"):
        await generate_user_display_id(session, email="jet@example.com")
