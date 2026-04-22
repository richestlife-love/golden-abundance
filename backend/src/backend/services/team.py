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
    led = (await session.execute(select(TeamRow).where(TeamRow.leader_id == user.id))).scalar_one_or_none()
    led_total = 0
    if led is not None:
        led_mems = (
            (await session.execute(select(TeamMembershipRow).where(TeamMembershipRow.team_id == led.id)))
            .scalars()
            .all()
        )
        led_total = 1 + len(led_mems)

    joined_link = (
        await session.execute(select(TeamMembershipRow).where(TeamMembershipRow.user_id == user.id))
    ).scalar_one_or_none()
    joined_total = 0
    if joined_link is not None:
        joined_mems = (
            (await session.execute(select(TeamMembershipRow).where(TeamMembershipRow.team_id == joined_link.team_id)))
            .scalars()
            .all()
        )
        joined_total = 1 + len(joined_mems)

    return led_total, joined_total


async def create_led_team(session: AsyncSession, user: UserRow) -> TeamRow:
    result = await session.execute(select(TeamRow.display_id))
    taken = {row[0] for row in result.all()}
    display_id = generate_team_display_id(user_display_id=user.display_id, used=taken)
    team = TeamRow(
        display_id=display_id,
        name=f"{derive_user_name(user)}的團隊",
        leader_id=user.id,
    )
    session.add(team)
    await session.flush()
    return team


async def row_to_contract_team(session: AsyncSession, team: TeamRow, *, caller_id: UUID) -> ContractTeam:
    leader = await session.get(UserRow, team.leader_id)
    if leader is None:
        raise RuntimeError(f"FK violation: TeamRow(id={team.id}).leader_id={team.leader_id} has no matching UserRow")

    memberships = (
        (await session.execute(select(TeamMembershipRow).where(TeamMembershipRow.team_id == team.id))).scalars().all()
    )
    member_user_ids = [m.user_id for m in memberships]
    members: list[ContractUserRef] = []
    if member_user_ids:
        member_rows = (await session.execute(select(UserRow).where(UserRow.id.in_(member_user_ids)))).scalars().all()
        members = [user_to_ref(u) for u in member_rows]

    if caller_id == team.leader_id:
        role: str | None = "leader"
    elif caller_id in member_user_ids:
        role = "member"
    else:
        role = None

    requests: list[ContractJoinRequest] | None
    if role == "leader":
        # Single join: load every pending request together with its
        # requester, eliminating the per-row ``session.get(UserRow, ...)``
        # N+1 the previous loop did (M4).
        pending_pairs = (
            await session.execute(
                select(JoinRequestRow, UserRow)
                .join(UserRow, JoinRequestRow.user_id == UserRow.id)
                .where(JoinRequestRow.team_id == team.id)
                .where(JoinRequestRow.status == "pending")
                .order_by(JoinRequestRow.requested_at.asc()),
            )
        ).all()
        requests = [
            ContractJoinRequest(
                id=jr.id,
                team_id=jr.team_id,
                user=user_to_ref(requester),
                status=jr.status,
                requested_at=jr.requested_at,
            )
            for jr, requester in pending_pairs
        ]
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
        role=role,
        requests=requests,
        created_at=team.created_at,
    )


def _escape_like(s: str) -> str:
    """Escape SQL LIKE metacharacters so user input matches literally.

    Without this, a user searching for ``%`` matches every row and ``_``
    matches any single character — both a correctness bug and (combined
    with the unindexed sequential scan) a cheap DoS lever. The escape
    character is ``\\``; callers must pass ``escape="\\\\"`` to the
    ILIKE expression for Postgres to respect it.
    """
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def search_team_refs(
    session: AsyncSession,
    *,
    q: str | None,
    topic: str | None,
    leader_display_id: str | None,
    cursor: str | None,
    limit: int,
) -> Paginated[ContractTeamRef]:
    stmt = select(TeamRow, UserRow).join(UserRow, TeamRow.leader_id == UserRow.id)
    if q:
        like = f"%{_escape_like(q)}%"
        stmt = stmt.where(
            TeamRow.name.ilike(like, escape="\\") | TeamRow.alias.ilike(like, escape="\\"),
        )
    if topic:
        stmt = stmt.where(TeamRow.topic == topic)
    if leader_display_id:
        stmt = stmt.where(UserRow.display_id == leader_display_id)

    page, next_cursor = await paginate_keyset(
        session,
        stmt,
        sort=[
            SortCol(
                TeamRow.created_at,
                to_json=lambda d: d.isoformat(),
                from_json=datetime.fromisoformat,
            ),
            SortCol(TeamRow.id, to_json=str, from_json=UUID),
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
