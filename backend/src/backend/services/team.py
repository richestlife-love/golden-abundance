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
    TeamMembershipRow,
    TeamRow,
    UserRow,
)
from backend.services.display_id import generate_team_display_id
from backend.services.pagination import SortCol, paginate_keyset
from backend.services.user import derive_user_name


def user_to_ref(row: UserRow) -> ContractUserRef:
    return ContractUserRef(
        id=row.id,
        display_id=row.display_id,
        name=derive_user_name(row),
        avatar_url=row.avatar_url,
    )


async def caller_team_totals(session: AsyncSession, user: UserRow) -> tuple[int, int]:
    """Return ``(led_total, joined_total)`` for ``user``.

    ``led_total`` is the headcount of the team the user leads (1 leader +
    N members), or 0 if they don't lead a team. ``joined_total`` is the
    headcount of the team they joined via membership, or 0. The caller
    decides what to do with the pair — spec §1.3 challenge progress uses
    ``max(led_total, joined_total)``.
    """
    led = (
        await session.execute(select(TeamRow).where(TeamRow.leader_id == user.id))  # ty: ignore[invalid-argument-type]
    ).scalar_one_or_none()
    led_total = 0
    if led is not None:
        led_mems = (
            (
                await session.execute(
                    select(TeamMembershipRow).where(TeamMembershipRow.team_id == led.id)  # ty: ignore[invalid-argument-type]
                )
            )
            .scalars()
            .all()
        )
        led_total = 1 + len(led_mems)

    joined_link = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.user_id == user.id)  # ty: ignore[invalid-argument-type]
        )
    ).scalar_one_or_none()
    joined_total = 0
    if joined_link is not None:
        joined_mems = (
            (
                await session.execute(
                    select(TeamMembershipRow).where(
                        TeamMembershipRow.team_id == joined_link.team_id  # ty: ignore[invalid-argument-type]
                    )
                )
            )
            .scalars()
            .all()
        )
        joined_total = 1 + len(joined_mems)

    return led_total, joined_total


async def create_led_team(session: AsyncSession, user: UserRow) -> TeamRow:
    result = await session.execute(select(TeamRow.display_id))  # ty: ignore[no-matching-overload]
    taken = {row[0] for row in result.all()}
    display_id = generate_team_display_id(user_display_id=user.display_id, used=taken)
    team = TeamRow(
        display_id=display_id,
        name=f"{derive_user_name(user)}的團隊",
        leader_id=user.id,
    )  # ty: ignore[missing-argument]
    session.add(team)
    await session.flush()
    return team


async def row_to_contract_team(session: AsyncSession, team: TeamRow, *, caller_id: UUID) -> ContractTeam:
    leader = await session.get(UserRow, team.leader_id)
    if leader is None:
        raise RuntimeError(f"FK violation: TeamRow(id={team.id}).leader_id={team.leader_id} has no matching UserRow")

    memberships = (
        (
            await session.execute(
                select(TeamMembershipRow).where(TeamMembershipRow.team_id == team.id)  # ty: ignore[invalid-argument-type]
            )
        )
        .scalars()
        .all()
    )
    member_user_ids = [m.user_id for m in memberships]
    members: list[ContractUserRef] = []
    if member_user_ids:
        member_rows = (
            (
                await session.execute(
                    select(UserRow).where(UserRow.id.in_(member_user_ids))  # ty: ignore[unresolved-attribute]
                )
            )
            .scalars()
            .all()
        )
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
            (
                await session.execute(
                    select(JoinRequestRow)
                    .where(JoinRequestRow.team_id == team.id)  # ty: ignore[invalid-argument-type]
                    .where(JoinRequestRow.status == "pending")  # ty: ignore[invalid-argument-type]
                    .order_by(JoinRequestRow.requested_at.asc())  # ty: ignore[unresolved-attribute]
                )
            )
            .scalars()
            .all()
        )
        requests = []
        for jr in join_rows:
            requester = await session.get(UserRow, jr.user_id)
            if requester is None:
                raise RuntimeError(
                    f"FK violation: JoinRequestRow(id={jr.id}).user_id={jr.user_id} has no matching UserRow"
                )
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
