"""DB-level constraint regression tests.

Each test bypasses the service layer and writes directly via
``session.add`` or raw SQL, so a regression that silently drops a
constraint at the DB level fails here instead of only showing up as a
race condition.
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import (
    JoinRequestRow,
    RewardRow,
    TaskDefRow,
    TaskProgressRow,
    TeamMembershipRow,
    TeamRow,
    UserRow,
)


async def _seed_two_teams_and_user(session: AsyncSession) -> tuple[TeamRow, TeamRow, UserRow]:
    leader_a = UserRow(id=uuid4(), display_id="ULDA", email="lda@example.com", profile_complete=True)
    leader_b = UserRow(id=uuid4(), display_id="ULDB", email="ldb@example.com", profile_complete=True)
    requester = UserRow(id=uuid4(), display_id="UREQ", email="req@example.com", profile_complete=True)
    session.add_all([leader_a, leader_b, requester])
    await session.flush()
    team_a = TeamRow(display_id="T-TA", name="A", leader_id=leader_a.id)
    team_b = TeamRow(display_id="T-TB", name="B", leader_id=leader_b.id)
    session.add_all([team_a, team_b])
    await session.flush()
    return team_a, team_b, requester


async def test_pending_join_request_unique_per_user(session: AsyncSession) -> None:
    """Two concurrent pending requests from the same user must fail at the DB."""
    team_a, team_b, requester = await _seed_two_teams_and_user(session)

    session.add(JoinRequestRow(team_id=team_a.id, user_id=requester.id, status="pending"))
    await session.flush()

    session.add(JoinRequestRow(team_id=team_b.id, user_id=requester.id, status="pending"))
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
        ),
    )
    session.add(
        JoinRequestRow(
            id=uuid4(),
            team_id=team_b.id,
            user_id=requester.id,
            status="pending",
        ),
    )
    await session.flush()

    count = (
        await session.execute(
            text("SELECT count(*) FROM join_requests WHERE user_id = :uid"),
            {"uid": requester.id},
        )
    ).scalar_one()
    assert count == 2


# Note: the ``teams.cap/points/week_points`` CHECK constraints were
# dropped in migration 0008 along with the columns themselves. No
# replacement tests — aggregate points live in the leaderboard view
# and the team size cap is a property of the T3 challenge task def.


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
        "        false, now())",
    )
    # PT012: the CHECK fires on flush (execute only queues), so the block
    # needs both statements — splitting defeats the test.
    with pytest.raises(IntegrityError):  # noqa: PT012
        await session.execute(stmt)
        await session.flush()
    await session.rollback()


async def test_timestamp_server_defaults_populate_on_raw_insert(session: AsyncSession) -> None:
    """Raw SQL inserts that omit the timestamp column must still succeed —
    ``server_default=now()`` fills it in so seed-reset / ad-hoc psql work.
    """
    await session.execute(
        text(
            "INSERT INTO users (id, display_id, email, profile_complete)"
            " VALUES (gen_random_uuid(), 'URAW', 'raw@example.com', false)",
        ),
    )
    created = (await session.execute(text("SELECT created_at FROM users WHERE email = 'raw@example.com'"))).scalar_one()
    assert created is not None
    await session.rollback()


async def test_task_progress_progress_unit_interval(session: AsyncSession) -> None:
    """``progress`` must be within [0, 1] when set."""
    user = UserRow(id=uuid4(), display_id="UPRG", email="prg@example.com", profile_complete=True)
    session.add(user)
    await session.flush()
    td_insert = text(
        "INSERT INTO task_defs (id, display_id, title, summary, description, tag, color,"
        "                       points, est_minutes, is_challenge, created_at)"
        " VALUES (:tid, 'TPRG', 'x', 'x', 'x', '探索', '#000000', 0, 0, false, now())",
    )
    td_id = uuid4()
    await session.execute(td_insert, {"tid": td_id})
    stmt = text(
        "INSERT INTO task_progress (id, user_id, task_def_id, status, progress, updated_at)"
        " VALUES (gen_random_uuid(), :uid, :tid, 'in_progress', 1.5, now())",
    )
    # PT012: the CHECK fires on flush (execute only queues), so the block
    # needs both statements — splitting defeats the test.
    with pytest.raises(IntegrityError):  # noqa: PT012
        await session.execute(stmt, {"uid": user.id, "tid": td_id})
        await session.flush()
    await session.rollback()


async def test_delete_user_cascades_to_dependent_rows(session: AsyncSession) -> None:
    """Deleting a user row must cascade through every child table — the FKs
    were rewritten with ``ON DELETE CASCADE`` in migration 0007.
    """
    team_a, _, requester = await _seed_two_teams_and_user(session)
    session.add(TeamMembershipRow(team_id=team_a.id, user_id=requester.id))
    session.add(JoinRequestRow(team_id=team_a.id, user_id=requester.id, status="rejected"))
    td = TaskDefRow(
        display_id="TCAS",
        title="x",
        summary="x",
        description="x",
        tag="探索",
        color="#000000",
        points=0,
        est_minutes=0,
        is_challenge=False,
    )
    session.add(td)
    await session.flush()
    session.add(TaskProgressRow(user_id=requester.id, task_def_id=td.id, status="completed", progress=1.0))
    session.add(RewardRow(user_id=requester.id, task_def_id=td.id, task_title="x", bonus="b", status="earned"))
    await session.commit()

    await session.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": requester.id})
    await session.commit()

    for query in (
        "SELECT count(*) FROM team_memberships WHERE user_id = :uid",
        "SELECT count(*) FROM join_requests WHERE user_id = :uid",
        "SELECT count(*) FROM task_progress WHERE user_id = :uid",
        "SELECT count(*) FROM rewards WHERE user_id = :uid",
    ):
        remaining = (await session.execute(text(query), {"uid": requester.id})).scalar_one()
        assert remaining == 0, f"{query} left {remaining} orphan rows"
