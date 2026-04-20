"""Team membership mutations: join-request lifecycle and leave.

Kept separate from `services.team` because the join/approve/reject/leave
flow has its own invariants (one pending request, one membership, leader
self-join forbidden) and its own reward-cascade side effect via
``approve_join_request``.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import (
    JoinRequestRow,
    TaskDefRow,
    TeamMembershipRow,
    TeamRow,
    UserRow,
)
from backend.services.reward import maybe_grant_challenge_rewards


class JoinConflict(Exception):
    """Business-rule violation during join-request creation."""


async def create_join_request(session: AsyncSession, *, team: TeamRow, requester: UserRow) -> JoinRequestRow:
    if team.leader_id == requester.id:
        raise JoinConflict("Leaders cannot request to join their own team")

    # Already a member of THIS team?
    existing_membership = (
        await session.execute(
            select(TeamMembershipRow).where(
                TeamMembershipRow.team_id == team.id,  # ty: ignore[invalid-argument-type]
                TeamMembershipRow.user_id == requester.id,  # ty: ignore[invalid-argument-type]
            )
        )
    ).scalar_one_or_none()
    if existing_membership is not None:
        raise JoinConflict("Already a member of this team")

    # Any existing team membership at all?
    any_membership = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.user_id == requester.id)  # ty: ignore[invalid-argument-type]
        )
    ).scalar_one_or_none()
    if any_membership is not None:
        raise JoinConflict("Already a member of a different team")

    # Any existing pending request?
    any_pending = (
        await session.execute(
            select(JoinRequestRow)
            .where(JoinRequestRow.user_id == requester.id)  # ty: ignore[invalid-argument-type]
            .where(JoinRequestRow.status == "pending")  # ty: ignore[invalid-argument-type]
        )
    ).scalar_one_or_none()
    if any_pending is not None:
        raise JoinConflict("Already has a pending join request")

    req = JoinRequestRow(team_id=team.id, user_id=requester.id, status="pending")  # ty: ignore[missing-argument]
    session.add(req)
    await session.flush()
    return req


async def approve_join_request(session: AsyncSession, *, team: TeamRow, req: JoinRequestRow) -> None:
    req.status = "approved"
    session.add(req)
    session.add(TeamMembershipRow(team_id=team.id, user_id=req.user_id))  # ty: ignore[missing-argument]
    await session.flush()

    # Skip the reward cascade when no bonused challenges exist —
    # default seed has no bonuses, saving an N+1 per approval.
    challenge_defs = (
        (
            await session.execute(
                select(TaskDefRow)
                .where(TaskDefRow.is_challenge.is_(True))  # ty: ignore[unresolved-attribute]
                .where(TaskDefRow.bonus.is_not(None))  # ty: ignore[unresolved-attribute]
            )
        )
        .scalars()
        .all()
    )
    if not challenge_defs:
        return

    # Post-flush: query includes the just-added membership.
    memberships = (
        (
            await session.execute(
                select(TeamMembershipRow).where(TeamMembershipRow.team_id == team.id)  # ty: ignore[invalid-argument-type]
            )
        )
        .scalars()
        .all()
    )
    member_ids = [team.leader_id] + [row.user_id for row in memberships]
    for uid in member_ids:
        user_row = await session.get(UserRow, uid)
        if user_row is not None:
            await maybe_grant_challenge_rewards(session, user=user_row)


async def reject_join_request(session: AsyncSession, *, req: JoinRequestRow) -> None:
    req.status = "rejected"
    session.add(req)
    await session.flush()


async def leave_team(session: AsyncSession, *, team: TeamRow, user: UserRow) -> None:
    link = (
        await session.execute(
            select(TeamMembershipRow).where(
                TeamMembershipRow.team_id == team.id,  # ty: ignore[invalid-argument-type]
                TeamMembershipRow.user_id == user.id,  # ty: ignore[invalid-argument-type]
            )
        )
    ).scalar_one_or_none()
    if link is not None:
        await session.delete(link)
        await session.flush()
