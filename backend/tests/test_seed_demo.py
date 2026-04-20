"""Phase 4a demo seed — exercises DEMO_USERS upsert."""

from __future__ import annotations

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import SQLModel

from backend.db.engine import get_session_maker
from backend.db.models import JoinRequestRow, TeamRow, UserRow
from backend.seed import DEMO_USERS
from backend.seed import run as run_seed

pytestmark = pytest.mark.asyncio


async def _truncate_all(engine: AsyncEngine) -> None:
    tables = ", ".join(f'"{t.name}"' for t in SQLModel.metadata.sorted_tables)
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))


async def test_demo_users_seeded(engine: AsyncEngine) -> None:
    await _truncate_all(engine)
    await run_seed()

    async with get_session_maker()() as s:
        rows = (await s.execute(select(UserRow))).scalars().all()

    emails = {u.email for u in rows}
    assert emails >= {u["email"] for u in DEMO_USERS}
    for u in rows:
        if u.email.endswith("@demo.gal"):
            assert u.profile_complete is True, f"{u.email} should be profile-complete"
            assert u.zh_name, f"{u.email} should have zh_name set"
            assert u.display_id.startswith("U"), f"{u.email} display_id shape"


async def test_demo_users_idempotent(engine: AsyncEngine) -> None:
    await _truncate_all(engine)
    await run_seed()
    async with get_session_maker()() as s:
        first = len((await s.execute(select(UserRow))).scalars().all())
    await run_seed()
    async with get_session_maker()() as s:
        second = len((await s.execute(select(UserRow))).scalars().all())
    assert first == second, "second run must add zero users"


DEMO_FANOUT_EXPECTED = {
    "alex@demo.gal": "jet@demo.gal",
    "mei@demo.gal": "jet@demo.gal",
    "kai@demo.gal": "ami@demo.gal",
    "yu@demo.gal": "ami@demo.gal",
}


async def _pending_requests(s) -> list[JoinRequestRow]:
    return (
        (
            await s.execute(
                select(JoinRequestRow).where(JoinRequestRow.status == "pending")  # ty: ignore[invalid-argument-type]
            )
        )
        .scalars()
        .all()
    )


async def test_demo_join_requests_fanout(engine: AsyncEngine) -> None:
    await _truncate_all(engine)
    await run_seed()

    async with get_session_maker()() as s:
        users = {u.email: u for u in (await s.execute(select(UserRow))).scalars().all()}
        teams = {t.leader_id: t for t in (await s.execute(select(TeamRow))).scalars().all()}
        reqs = await _pending_requests(s)

    actual: dict[str, str] = {}
    for r in reqs:
        team = next((t for t in teams.values() if t.id == r.team_id), None)
        requester = next((u for u in users.values() if u.id == r.user_id), None)
        if team is None or requester is None:
            continue
        leader = next((u for u in users.values() if u.id == team.leader_id), None)
        if leader is None or not requester.email.endswith("@demo.gal"):
            continue
        actual[requester.email] = leader.email

    assert actual == DEMO_FANOUT_EXPECTED, f"fan-out mismatch: {actual}"


async def test_demo_at_most_one_pending_per_user(engine: AsyncEngine) -> None:
    """Phase 5c invariant: a user can have at most one pending request anywhere."""
    await _truncate_all(engine)
    await run_seed()
    async with get_session_maker()() as s:
        reqs = await _pending_requests(s)
    per_user: dict = {}
    for r in reqs:
        per_user[r.user_id] = per_user.get(r.user_id, 0) + 1
    for uid, count in per_user.items():
        assert count == 1, f"user {uid} has {count} pending requests"


async def test_demo_join_requests_idempotent(engine: AsyncEngine) -> None:
    await _truncate_all(engine)
    await run_seed()
    async with get_session_maker()() as s:
        first = len(await _pending_requests(s))
    await run_seed()
    async with get_session_maker()() as s:
        second = len(await _pending_requests(s))
    assert first == second == 4, f"expected 4 pending rows, got first={first} second={second}"
