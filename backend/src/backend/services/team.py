"""Team service: creation, caller-scoped mapping, and search.

``create_led_team`` is called from the profile-completion flow in the
same transaction that flips ``profile_complete`` to True. The default
name is ``"{user_name}的團隊"``; the user can override via ``alias``
later. Initial topic is the literal ``"尚未指定主題"`` — matches the
frontend prototype's placeholder (see contract design §1.4).
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import JoinRequest as ContractJoinRequest
from backend.contract import Paginated
from backend.contract import Team as ContractTeam
from backend.contract import TeamRef as ContractTeamRef
from backend.contract import UserRef as ContractUserRef
from backend.db.models import (
    JoinRequestRow,
    RewardRow,
    TaskDefRow,
    TeamMembershipRow,
    TeamRow,
    UserRow,
)
from backend.services.display_id import generate_team_display_id
from backend.services.pagination import SortCol, paginate_keyset


def user_to_ref(row: UserRow) -> ContractUserRef:
    name = row.zh_name or row.nickname or row.email.split("@", 1)[0]
    return ContractUserRef(
        id=row.id, display_id=row.display_id, name=name, avatar_url=row.avatar_url
    )


async def create_led_team(session: AsyncSession, user: UserRow) -> TeamRow:
    result = await session.execute(select(TeamRow.display_id))  # ty: ignore[no-matching-overload]
    taken = {row[0] for row in result.all()}
    display_id = generate_team_display_id(user_display_id=user.display_id, used=taken)
    leader_name = user.zh_name or user.nickname or user.email.split("@", 1)[0]
    team = TeamRow(
        display_id=display_id,
        name=f"{leader_name}的團隊",
        leader_id=user.id,
    )  # ty: ignore[missing-argument]
    session.add(team)
    await session.flush()
    return team


async def row_to_contract_team(
    session: AsyncSession, team: TeamRow, *, caller_id: UUID
) -> ContractTeam:
    leader = await session.get(UserRow, team.leader_id)
    assert leader is not None  # FK-guaranteed

    memberships = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.team_id == team.id)  # ty: ignore[invalid-argument-type]
        )
    ).scalars().all()
    member_user_ids = [m.user_id for m in memberships]
    members: list[ContractUserRef] = []
    if member_user_ids:
        member_rows = (
            await session.execute(
                select(UserRow).where(UserRow.id.in_(member_user_ids))  # ty: ignore[unresolved-attribute]
            )
        ).scalars().all()
        members = [user_to_ref(u) for u in member_rows]

    if caller_id == team.leader_id:
        role: str | None = "leader"
    elif caller_id in member_user_ids:
        role = "member"
    else:
        role = None

    requests: list[ContractJoinRequest] | None
    if role == "leader":
        join_rows = (
            await session.execute(
                select(JoinRequestRow)
                .where(JoinRequestRow.team_id == team.id)  # ty: ignore[invalid-argument-type]
                .where(JoinRequestRow.status == "pending")  # ty: ignore[invalid-argument-type]
                .order_by(JoinRequestRow.requested_at.asc())  # ty: ignore[unresolved-attribute]
            )
        ).scalars().all()
        requests = []
        for jr in join_rows:
            requester = await session.get(UserRow, jr.user_id)
            assert requester is not None  # FK-guaranteed
            requests.append(
                ContractJoinRequest(
                    id=jr.id,
                    team_id=jr.team_id,
                    user=user_to_ref(requester),
                    status=jr.status,
                    requested_at=jr.requested_at,
                )
            )
    else:
        requests = None

    return ContractTeam(
        id=team.id,
        display_id=team.display_id,
        name=team.name,
        alias=team.alias,
        topic=team.topic,
        leader=user_to_ref(leader),
        members=members,
        cap=team.cap,
        points=team.points,
        week_points=team.week_points,
        rank=None,
        role=role,  # type: ignore[arg-type]
        requests=requests,
        created_at=team.created_at,
    )


async def search_team_refs(
    session: AsyncSession,
    *,
    q: str | None,
    topic: str | None,
    leader_display_id: str | None,
    cursor: str | None,
    limit: int,
) -> Paginated[ContractTeamRef]:
    stmt = select(TeamRow, UserRow).join(UserRow, TeamRow.leader_id == UserRow.id)  # ty: ignore[invalid-argument-type]
    if q:
        like = f"%{q}%"
        stmt = stmt.where(TeamRow.name.ilike(like) | TeamRow.alias.ilike(like))  # ty: ignore[unresolved-attribute]
    if topic:
        stmt = stmt.where(TeamRow.topic == topic)  # ty: ignore[invalid-argument-type]
    if leader_display_id:
        stmt = stmt.where(UserRow.display_id == leader_display_id)  # ty: ignore[invalid-argument-type]

    page, next_cursor = await paginate_keyset(
        session,
        stmt,
        sort=[
            SortCol(
                TeamRow.created_at,  # ty: ignore[invalid-argument-type]
                to_json=lambda d: d.isoformat(),
                from_json=datetime.fromisoformat,
            ),
            SortCol(TeamRow.id, to_json=str, from_json=UUID),  # ty: ignore[invalid-argument-type]
        ],
        cursor=cursor,
        limit=limit,
        extract=lambda r: (r[0].created_at, r[0].id),
    )

    items = [
        ContractTeamRef(
            id=team.id,
            display_id=team.display_id,
            name=team.name,
            topic=team.topic,
            leader=user_to_ref(leader),
        )
        for team, leader in page
    ]
    return Paginated[ContractTeamRef](items=items, next_cursor=next_cursor)


class JoinConflict(Exception):
    """Business-rule violation during join-request creation."""


async def create_join_request(
    session: AsyncSession, *, team: TeamRow, requester: UserRow
) -> JoinRequestRow:
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


async def approve_join_request(
    session: AsyncSession, *, team: TeamRow, req: JoinRequestRow
) -> None:
    req.status = "approved"
    session.add(req)
    session.add(TeamMembershipRow(team_id=team.id, user_id=req.user_id))  # ty: ignore[missing-argument]
    await session.flush()

    # Team just grew — reward any user on this team whose challenge-task
    # cap is now met. Short-circuit when no bonused challenges exist (the
    # default Phase-5 seed: T3.bonus is None) so we skip the per-member
    # reward cascade entirely instead of burning N × (3–4 SELECTs) per
    # approval. This keeps the branch ready for when a bonused challenge
    # does ship, without paying for it today.
    challenge_defs = (
        await session.execute(
            select(TaskDefRow)
            .where(TaskDefRow.is_challenge.is_(True))  # ty: ignore[unresolved-attribute]
            .where(TaskDefRow.bonus.is_not(None))  # ty: ignore[unresolved-attribute]
        )
    ).scalars().all()
    if not challenge_defs:
        return

    # Post-flush: the query returns the just-added membership, so
    # leader + memberships covers every team member exactly once.
    memberships = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.team_id == team.id)  # ty: ignore[invalid-argument-type]
        )
    ).scalars().all()
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


async def maybe_grant_challenge_rewards(
    session: AsyncSession, *, user: UserRow
) -> None:
    """Create RewardRows for any bonused challenge TaskDef where the user
    now meets cap and no reward row already exists. Idempotent. No-op
    when the user has no team (total == 0) or no bonused challenges exist.
    """
    challenge_defs = (
        await session.execute(
            select(TaskDefRow)
            .where(TaskDefRow.is_challenge.is_(True))  # ty: ignore[unresolved-attribute]
            .where(TaskDefRow.bonus.is_not(None))  # ty: ignore[unresolved-attribute]
        )
    ).scalars().all()
    if not challenge_defs:
        return

    # Compute user's current team totals (leader + members of led team,
    # leader + members of joined team; take max).
    led_team = (
        await session.execute(select(TeamRow).where(TeamRow.leader_id == user.id))  # ty: ignore[invalid-argument-type]
    ).scalar_one_or_none()
    led_total = 0
    if led_team is not None:
        led_mems = (
            await session.execute(
                select(TeamMembershipRow).where(TeamMembershipRow.team_id == led_team.id)  # ty: ignore[invalid-argument-type]
            )
        ).scalars().all()
        led_total = 1 + len(led_mems)
    joined_link = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.user_id == user.id)  # ty: ignore[invalid-argument-type]
        )
    ).scalar_one_or_none()
    joined_total = 0
    if joined_link is not None:
        joined_mems = (
            await session.execute(
                select(TeamMembershipRow).where(
                    TeamMembershipRow.team_id == joined_link.team_id  # ty: ignore[invalid-argument-type]
                )
            )
        ).scalars().all()
        joined_total = 1 + len(joined_mems)
    total = max(led_total, joined_total)

    for td in challenge_defs:
        assert td.cap is not None  # enforced by row_to_contract_task; re-verify here
        if total < td.cap:
            continue
        existing = (
            await session.execute(
                select(RewardRow)
                .where(RewardRow.user_id == user.id)  # ty: ignore[invalid-argument-type]
                .where(RewardRow.task_def_id == td.id)  # ty: ignore[invalid-argument-type]
            )
        ).scalar_one_or_none()
        if existing is not None:
            continue
        assert td.bonus is not None  # filtered by the query above
        session.add(
            RewardRow(  # ty: ignore[missing-argument]
                user_id=user.id,
                task_def_id=td.id,
                task_title=td.title,
                bonus=td.bonus,
                status="earned",
            )
        )
    await session.flush()
