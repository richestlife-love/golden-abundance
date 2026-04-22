from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import TeamMembershipRow, TeamRow, UserRow
from backend.services.team import create_led_team
from backend.services.team_join import (
    JoinConflictError,
    approve_join_request,
    create_join_request,
    leave_team,
    reject_join_request,
)
from backend.services.user import upsert_user_by_supabase_identity


async def _make_leader_and_outsider(session: AsyncSession) -> tuple[UserRow, UserRow, TeamRow]:
    leader = await upsert_user_by_supabase_identity(session, auth_user_id=uuid4(), email="leader@example.com")
    outsider = await upsert_user_by_supabase_identity(session, auth_user_id=uuid4(), email="out@example.com")
    await session.flush()
    team = await create_led_team(session, leader)
    await session.commit()
    return leader, outsider, team


async def test_create_join_request_happy_path(session: AsyncSession) -> None:
    _, outsider, team = await _make_leader_and_outsider(session)
    req = await create_join_request(session, team=team, requester=outsider)
    await session.commit()
    assert req.status == "pending"
    assert req.team_id == team.id
    assert req.user_id == outsider.id


async def test_create_join_request_rejects_self_leader(
    session: AsyncSession,
) -> None:
    leader, _, team = await _make_leader_and_outsider(session)
    with pytest.raises(JoinConflictError):
        await create_join_request(session, team=team, requester=leader)


async def test_create_join_request_rejects_duplicate_pending(
    session: AsyncSession,
) -> None:
    _, outsider, team = await _make_leader_and_outsider(session)
    await create_join_request(session, team=team, requester=outsider)
    await session.commit()
    with pytest.raises(JoinConflictError):
        await create_join_request(session, team=team, requester=outsider)


async def test_create_join_request_rejects_if_already_joined_elsewhere(
    session: AsyncSession,
) -> None:
    _, outsider, team = await _make_leader_and_outsider(session)
    other_leader = await upsert_user_by_supabase_identity(session, auth_user_id=uuid4(), email="other@example.com")
    await session.flush()
    other_team = await create_led_team(session, other_leader)
    session.add(TeamMembershipRow(team_id=other_team.id, user_id=outsider.id))
    await session.commit()
    with pytest.raises(JoinConflictError):
        await create_join_request(session, team=team, requester=outsider)


async def test_approve_moves_requester_to_members(
    session: AsyncSession,
) -> None:
    _, outsider, team = await _make_leader_and_outsider(session)
    req = await create_join_request(session, team=team, requester=outsider)
    await session.commit()
    await approve_join_request(session, team=team, req=req)
    await session.commit()
    assert req.status == "approved"
    links = (
        (await session.execute(select(TeamMembershipRow).where(TeamMembershipRow.team_id == team.id))).scalars().all()
    )
    assert any(link.user_id == outsider.id for link in links)


async def test_reject_marks_status_but_not_member(
    session: AsyncSession,
) -> None:
    _, outsider, team = await _make_leader_and_outsider(session)
    req = await create_join_request(session, team=team, requester=outsider)
    await session.commit()
    await reject_join_request(session, req=req)
    await session.commit()
    assert req.status == "rejected"
    links = (
        (await session.execute(select(TeamMembershipRow).where(TeamMembershipRow.team_id == team.id))).scalars().all()
    )
    assert links == []


async def test_leave_removes_membership(session: AsyncSession) -> None:
    _, outsider, team = await _make_leader_and_outsider(session)
    session.add(TeamMembershipRow(team_id=team.id, user_id=outsider.id))
    await session.commit()
    await leave_team(session, team=team, user=outsider)
    await session.commit()
    links = (
        (await session.execute(select(TeamMembershipRow).where(TeamMembershipRow.user_id == outsider.id)))
        .scalars()
        .all()
    )
    assert links == []
