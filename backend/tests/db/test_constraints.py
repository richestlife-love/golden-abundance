"""DB-level constraint regression tests.

Each test bypasses the service layer and writes directly via
``session.add`` or raw SQL, so a regression that silently drops a
constraint at the DB level fails here instead of only showing up as a
race condition.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import JoinRequestRow, TeamRow, UserRow


async def _seed_two_teams_and_user(session: AsyncSession) -> tuple[TeamRow, TeamRow, UserRow]:
    leader_a = UserRow(display_id="ULDA", email="lda@example.com", profile_complete=True)  # ty: ignore[missing-argument]
    leader_b = UserRow(display_id="ULDB", email="ldb@example.com", profile_complete=True)  # ty: ignore[missing-argument]
    requester = UserRow(display_id="UREQ", email="req@example.com", profile_complete=True)  # ty: ignore[missing-argument]
    session.add_all([leader_a, leader_b, requester])
    await session.flush()
    team_a = TeamRow(display_id="T-TA", name="A", leader_id=leader_a.id)  # ty: ignore[missing-argument]
    team_b = TeamRow(display_id="T-TB", name="B", leader_id=leader_b.id)  # ty: ignore[missing-argument]
    session.add_all([team_a, team_b])
    await session.flush()
    return team_a, team_b, requester


async def test_pending_join_request_unique_per_user(session: AsyncSession) -> None:
    """Two concurrent pending requests from the same user must fail at the DB."""
    team_a, team_b, requester = await _seed_two_teams_and_user(session)

    session.add(JoinRequestRow(team_id=team_a.id, user_id=requester.id, status="pending"))  # ty: ignore[missing-argument]
    await session.flush()

    session.add(JoinRequestRow(team_id=team_b.id, user_id=requester.id, status="pending"))  # ty: ignore[missing-argument]
    with pytest.raises(IntegrityError):
        await session.flush()
    await session.rollback()


async def test_pending_index_allows_mixed_statuses(session: AsyncSession) -> None:
    """The index only covers status='pending' — a rejected + pending pair is fine."""
    team_a, team_b, requester = await _seed_two_teams_and_user(session)

    session.add(
        JoinRequestRow(
            team_id=team_a.id,
            user_id=requester.id,
            status="rejected",
            requested_at=datetime.now(UTC),
        )
    )
    session.add(
        JoinRequestRow(  # ty: ignore[missing-argument]
            id=uuid4(),
            team_id=team_b.id,
            user_id=requester.id,
            status="pending",
        )
    )
    await session.flush()

    count = (
        await session.execute(
            text("SELECT count(*) FROM join_requests WHERE user_id = :uid"),
            {"uid": requester.id},
        )
    ).scalar_one()
    assert count == 2


@pytest.mark.parametrize(
    ("stmt", "params"),
    [
        (
            "INSERT INTO teams (id, display_id, name, topic, leader_id, cap, points, week_points, created_at)"
            " VALUES (gen_random_uuid(), 'T-CAP', 'x', 't', :leader, 0, 0, 0, now())",
            {},
        ),
        (
            "INSERT INTO teams (id, display_id, name, topic, leader_id, cap, points, week_points, created_at)"
            " VALUES (gen_random_uuid(), 'T-PTS', 'x', 't', :leader, 6, -1, 0, now())",
            {},
        ),
        (
            "INSERT INTO teams (id, display_id, name, topic, leader_id, cap, points, week_points, created_at)"
            " VALUES (gen_random_uuid(), 'T-WK', 'x', 't', :leader, 6, 0, -1, now())",
            {},
        ),
    ],
    ids=["cap-zero", "points-negative", "week-points-negative"],
)
async def test_teams_check_constraints(session: AsyncSession, stmt: str, params: dict) -> None:
    leader = UserRow(display_id="ULCK", email="lck@example.com", profile_complete=True)  # ty: ignore[missing-argument]
    session.add(leader)
    await session.flush()
    with pytest.raises(IntegrityError):
        await session.execute(text(stmt), {"leader": leader.id, **params})
        await session.flush()
    await session.rollback()


@pytest.mark.parametrize(
    ("col", "value"),
    [("points", -1), ("est_minutes", -1)],
)
async def test_task_defs_check_constraints(session: AsyncSession, col: str, value: int) -> None:
    stmt = text(
        "INSERT INTO task_defs (id, display_id, title, summary, description, tag, color,"
        f"                       points, est_minutes, is_challenge, created_at)"
        " VALUES (gen_random_uuid(), 'TCK', 'x', 'x', 'x', '探索', '#000000',"
        f"        {value if col == 'points' else 0}, {value if col == 'est_minutes' else 0},"
        "        false, now())"
    )
    with pytest.raises(IntegrityError):
        await session.execute(stmt)
        await session.flush()
    await session.rollback()


async def test_task_progress_progress_unit_interval(session: AsyncSession) -> None:
    """``progress`` must be within [0, 1] when set."""
    user = UserRow(display_id="UPRG", email="prg@example.com", profile_complete=True)  # ty: ignore[missing-argument]
    session.add(user)
    await session.flush()
    td_insert = text(
        "INSERT INTO task_defs (id, display_id, title, summary, description, tag, color,"
        "                       points, est_minutes, is_challenge, created_at)"
        " VALUES (:tid, 'TPRG', 'x', 'x', 'x', '探索', '#000000', 0, 0, false, now())"
    )
    td_id = uuid4()
    await session.execute(td_insert, {"tid": td_id})
    stmt = text(
        "INSERT INTO task_progress (id, user_id, task_def_id, status, progress, updated_at)"
        " VALUES (gen_random_uuid(), :uid, :tid, 'in_progress', 1.5, now())"
    )
    with pytest.raises(IntegrityError):
        await session.execute(stmt, {"uid": user.id, "tid": td_id})
        await session.flush()
    await session.rollback()
