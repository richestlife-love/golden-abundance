"""Phase 4a demo seed — exercises DEMO_USERS upsert."""

from __future__ import annotations

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import SQLModel

from backend.db.engine import get_session_maker
from backend.db.models import UserRow
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
