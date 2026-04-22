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
    TeamMembershipRow,
    TeamRow,
    UserRow,
)
from backend.services.reward import (
    grant_rewards_for_user,
    load_bonused_challenge_defs,
)


class JoinConflictError(Exception):
    """Business-rule violation during join-request creation."""


async def create_join_request(session: AsyncSession, *, team: TeamRow, requester: UserRow) -> JoinRequestRow:
    if team.leader_id == requester.id:
        raise JoinConflictError("Leaders cannot request to join their own team")

    # Already a member of THIS team?
    existing_membership = (
        await session.execute(
            select(TeamMembershipRow).where(
                TeamMembershipRow.team_id == team.id,
                TeamMembershipRow.user_id == requester.id,
            ),
        )
    ).scalar_one_or_none()
    if existing_membership is not None:
        raise JoinConflictError("Already a member of this team")

    # Any existing team membership at all?
    any_membership = (
        await session.execute(select(TeamMembershipRow).where(TeamMembershipRow.user_id == requester.id))
    ).scalar_one_or_none()
    if any_membership is not None:
        raise JoinConflictError("Already a member of a different team")

    # Any existing pending request?
    any_pending = (
        await session.execute(
            select(JoinRequestRow)
            .where(JoinRequestRow.user_id == requester.id)
            .where(JoinRequestRow.status == "pending"),
        )
    ).scalar_one_or_none()
    if any_pending is not None:
        raise JoinConflictError("Already has a pending join request")

    req = JoinRequestRow(team_id=team.id, user_id=requester.id, status="pending")
    session.add(req)
    await session.flush()
    return req


async def approve_join_request(session: AsyncSession, *, team: TeamRow, req: JoinRequestRow) -> None:
    req.status = "approved"
    session.add(req)
    session.add(TeamMembershipRow(team_id=team.id, user_id=req.user_id))
    await session.flush()

    # Skip the reward cascade when no bonused challenges exist — the default
    # seed has no bonuses, so this short-circuits every approval in dev/test.
    challenge_defs = await load_bonused_challenge_defs(session)
    if not challenge_defs:
        return

    # Batch-load the full post-approval membership list + all their UserRows
    # in two queries (instead of per-member N+1). Then pass the same
    # challenge_defs list to each user — ``grant_rewards_for_user`` does
    # not re-query them (M3).
    memberships = (
        (await session.execute(select(TeamMembershipRow).where(TeamMembershipRow.team_id == team.id))).scalars().all()
    )
    member_ids = [team.leader_id, *(m.user_id for m in memberships)]
    user_rows = (await session.execute(select(UserRow).where(UserRow.id.in_(member_ids)))).scalars().all()
    for user_row in user_rows:
        await grant_rewards_for_user(session, user=user_row, challenge_defs=challenge_defs)


async def reject_join_request(session: AsyncSession, *, req: JoinRequestRow) -> None:
    req.status = "rejected"
    session.add(req)
    await session.flush()


async def leave_team(session: AsyncSession, *, team: TeamRow, user: UserRow) -> None:
    link = (
        await session.execute(
            select(TeamMembershipRow).where(
                TeamMembershipRow.team_id == team.id,
                TeamMembershipRow.user_id == user.id,
            ),
        )
    ).scalar_one_or_none()
    if link is not None:
        await session.delete(link)
        await session.flush()
