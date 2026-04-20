"""Phase 5e debt item, addressed in Phase 4a: every display_id emitted
by the seed must round-trip through the contract's regex. If the
validator tightens, this catches it before the next seed run."""

from __future__ import annotations

import re

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import SQLModel

from backend.db.engine import get_session_maker
from backend.db.models import TaskDefRow, TeamRow, UserRow
from backend.seed import run as run_seed

pytestmark = pytest.mark.asyncio


# Keep these in sync with the Pydantic contract:
#   backend/src/backend/contract/user.py -> User.display_id pattern
#   backend/src/backend/contract/team.py -> Team.display_id pattern
#   backend/src/backend/contract/task.py -> Task.display_id (no pattern yet;
#     we pin the current shape so a future tightening gets noticed)
USER_DISPLAY_ID_RE = re.compile(r"^U[A-Z0-9]{3,7}$")
TEAM_DISPLAY_ID_RE = re.compile(r"^T-[A-Z0-9]{3,10}$")
TASK_DISPLAY_ID_RE = re.compile(r"^T[0-9A-Z]+$")


async def _truncate_all(engine: AsyncEngine) -> None:
    tables = ", ".join(f'"{t.name}"' for t in SQLModel.metadata.sorted_tables)
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))


async def test_seeded_user_display_ids_round_trip(engine: AsyncEngine) -> None:
    await _truncate_all(engine)
    await run_seed()
    async with get_session_maker()() as s:
        rows = (await s.execute(select(UserRow))).scalars().all()
    assert rows, "seed produced no users"
    for u in rows:
        assert USER_DISPLAY_ID_RE.match(u.display_id), u.display_id


async def test_seeded_team_display_ids_round_trip(engine: AsyncEngine) -> None:
    await _truncate_all(engine)
    await run_seed()
    async with get_session_maker()() as s:
        rows = (await s.execute(select(TeamRow))).scalars().all()
    assert rows, "seed produced no teams"
    for t in rows:
        assert TEAM_DISPLAY_ID_RE.match(t.display_id), t.display_id


async def test_seeded_task_display_ids_round_trip(engine: AsyncEngine) -> None:
    await _truncate_all(engine)
    await run_seed()
    async with get_session_maker()() as s:
        rows = (await s.execute(select(TaskDefRow))).scalars().all()
    assert rows, "seed produced no tasks"
    for t in rows:
        assert TASK_DISPLAY_ID_RE.match(t.display_id), t.display_id
