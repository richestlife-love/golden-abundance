"""Leaderboard queries.

Ranking and pagination happen entirely in SQL: points are aggregated
from ``task_progress`` using ``SUM(...) FILTER (WHERE ...)`` windows,
sort is ``(points DESC, id ASC)``, and pagination is keyset over
``(points, id)``. The window-start and week-start timestamps are sent
as bound parameters so the database plans can reuse the same query
across periods.

Rank is computed off a cursor payload that carries the last-returned
row's ``(points, id, rank)`` tuple — cheaper than a ``ROW_NUMBER()``
full-scan.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import (
    LeaderboardPeriod,
    Paginated,
    TeamLeaderboardEntry,
    TeamRef,
    UserLeaderboardEntry,
    UserRef,
)
from backend.db.models import (
    TaskDefRow,
    TaskProgressRow,
    TeamMembershipRow,
    TeamRow,
    UserRow,
)
from backend.services.pagination import (
    InvalidCursorError,
    decode_cursor,
    encode_cursor,
)
from backend.services.user import derive_user_name


def _since(period: LeaderboardPeriod) -> datetime:
    """Lower-bound timestamp for the window. ``all_time`` is epoch."""
    now = datetime.now(UTC)
    if period == "week":
        return now - timedelta(days=7)
    if period == "month":
        return now - timedelta(days=30)
    return datetime(1970, 1, 1, tzinfo=UTC)


def _decode_leaderboard_cursor(cursor: str | None) -> tuple[int, UUID, int] | None:
    """Decode ``{"pts": int, "id": str, "rank": int}`` — or None.

    Raises ``InvalidCursorError`` on any shape mismatch; the global
    handler in ``server.py`` turns that into a 400 response.
    """
    if cursor is None:
        return None
    payload = decode_cursor(cursor)
    if not isinstance(payload, dict):
        raise InvalidCursorError("leaderboard cursor must be an object")
    try:
        pts = int(payload["pts"])
        eid = UUID(str(payload["id"]))
        rank = int(payload["rank"])
    except (KeyError, TypeError, ValueError) as exc:
        raise InvalidCursorError(f"leaderboard cursor missing/invalid field: {exc}") from exc
    return pts, eid, rank


def _encode_leaderboard_cursor(*, pts: int, eid: UUID, rank: int) -> str:
    return encode_cursor({"pts": int(pts), "id": str(eid), "rank": int(rank)})


def _apply_keyset_filter(
    stmt: Select[Any],
    pts_col: Any,
    id_col: Any,
    cursor: tuple[int, UUID, int] | None,
) -> Select[Any]:
    """Strictly-after-cursor filter under ``ORDER BY pts DESC, id ASC``.

    A row is after the cursor iff ``pts < cursor_pts`` OR
    ``pts == cursor_pts AND id > cursor_id``. Writing it out rather than
    using tuple-compare because ``(pts DESC, id ASC)`` mixes directions
    and Postgres's tuple compare is uniform-direction only.
    """
    if cursor is None:
        return stmt
    cur_pts, cur_id, _ = cursor
    return stmt.where(
        or_(
            pts_col < cur_pts,
            and_(pts_col == cur_pts, id_col > cur_id),
        ),
    )


async def leaderboard_users(
    session: AsyncSession,
    *,
    period: LeaderboardPeriod,
    cursor: str | None,
    limit: int,
) -> Paginated[UserLeaderboardEntry]:
    window_start = _since(period)
    week_start = datetime.now(UTC) - timedelta(days=7)
    decoded = _decode_leaderboard_cursor(cursor)

    points_expr = func.coalesce(
        func.sum(TaskDefRow.points).filter(
            TaskProgressRow.status == "completed",
            TaskProgressRow.completed_at >= window_start,
        ),
        0,
    )
    week_points_expr = func.coalesce(
        func.sum(TaskDefRow.points).filter(
            TaskProgressRow.status == "completed",
            TaskProgressRow.completed_at >= week_start,
        ),
        0,
    )
    sub = (
        select(
            UserRow.id.label("id"),
            UserRow.display_id.label("display_id"),
            UserRow.zh_name.label("zh_name"),
            UserRow.en_name.label("en_name"),
            UserRow.nickname.label("nickname"),
            UserRow.email.label("email"),
            UserRow.avatar_url.label("avatar_url"),
            points_expr.label("points"),
            week_points_expr.label("week_points"),
        )
        .select_from(UserRow)
        .join(TaskProgressRow, TaskProgressRow.user_id == UserRow.id, isouter=True)
        .join(TaskDefRow, TaskDefRow.id == TaskProgressRow.task_def_id, isouter=True)
        .group_by(UserRow.id)
        .subquery()
    )

    stmt = select(sub).order_by(sub.c.points.desc(), sub.c.id.asc())
    stmt = _apply_keyset_filter(stmt, sub.c.points, sub.c.id, decoded)
    stmt = stmt.limit(limit + 1)

    rows = (await session.execute(stmt)).all()
    page = list(rows[:limit])

    start_rank = decoded[2] + 1 if decoded else 1
    items: list[UserLeaderboardEntry] = []
    for offset, row in enumerate(page):
        items.append(
            UserLeaderboardEntry(
                user=UserRef(
                    id=row.id,
                    display_id=row.display_id,
                    name=_derive_name_from_cols(
                        zh_name=row.zh_name,
                        nickname=row.nickname,
                        email=row.email,
                    ),
                    avatar_url=row.avatar_url,
                ),
                rank=start_rank + offset,
                points=int(row.points),
                week_points=int(row.week_points),
            ),
        )

    next_cursor: str | None = None
    if len(rows) > limit and page:
        last = page[-1]
        next_cursor = _encode_leaderboard_cursor(
            pts=int(last.points),
            eid=last.id,
            rank=start_rank + len(page) - 1,
        )
    return Paginated[UserLeaderboardEntry](items=items, next_cursor=next_cursor)


async def leaderboard_teams(
    session: AsyncSession,
    *,
    period: LeaderboardPeriod,
    cursor: str | None,
    limit: int,
) -> Paginated[TeamLeaderboardEntry]:
    window_start = _since(period)
    week_start = datetime.now(UTC) - timedelta(days=7)
    decoded = _decode_leaderboard_cursor(cursor)

    # A team's total membership is the leader plus every row in
    # team_memberships. The UNION ALL below folds both into one
    # "team_member" set so a single LEFT JOIN onto task_progress
    # covers both.
    member_leader = select(
        TeamRow.id.label("team_id"),
        TeamRow.leader_id.label("user_id"),
    )
    member_memberships = select(
        TeamMembershipRow.team_id.label("team_id"),
        TeamMembershipRow.user_id.label("user_id"),
    )
    team_members = member_leader.union_all(member_memberships).subquery("team_members")

    points_expr = func.coalesce(
        func.sum(TaskDefRow.points).filter(
            TaskProgressRow.status == "completed",
            TaskProgressRow.completed_at >= window_start,
        ),
        0,
    )
    week_points_expr = func.coalesce(
        func.sum(TaskDefRow.points).filter(
            TaskProgressRow.status == "completed",
            TaskProgressRow.completed_at >= week_start,
        ),
        0,
    )

    leader = UserRow.__table__.alias("leader")
    sub = (
        select(
            TeamRow.id.label("id"),
            TeamRow.display_id.label("display_id"),
            TeamRow.name.label("name"),
            TeamRow.topic.label("topic"),
            leader.c.id.label("leader_id"),
            leader.c.display_id.label("leader_display_id"),
            leader.c.zh_name.label("leader_zh_name"),
            leader.c.nickname.label("leader_nickname"),
            leader.c.email.label("leader_email"),
            leader.c.avatar_url.label("leader_avatar_url"),
            points_expr.label("points"),
            week_points_expr.label("week_points"),
        )
        .select_from(TeamRow)
        .join(leader, leader.c.id == TeamRow.leader_id)
        .join(team_members, team_members.c.team_id == TeamRow.id, isouter=True)
        .join(
            TaskProgressRow,
            TaskProgressRow.user_id == team_members.c.user_id,
            isouter=True,
        )
        .join(TaskDefRow, TaskDefRow.id == TaskProgressRow.task_def_id, isouter=True)
        .group_by(TeamRow.id, leader.c.id)
        .subquery()
    )

    stmt = select(sub).order_by(sub.c.points.desc(), sub.c.id.asc())
    stmt = _apply_keyset_filter(stmt, sub.c.points, sub.c.id, decoded)
    stmt = stmt.limit(limit + 1)

    rows = (await session.execute(stmt)).all()
    page = list(rows[:limit])

    start_rank = decoded[2] + 1 if decoded else 1
    items: list[TeamLeaderboardEntry] = []
    for offset, row in enumerate(page):
        items.append(
            TeamLeaderboardEntry(
                team=TeamRef(
                    id=row.id,
                    display_id=row.display_id,
                    name=row.name,
                    topic=row.topic,
                    leader=UserRef(
                        id=row.leader_id,
                        display_id=row.leader_display_id,
                        name=_derive_name_from_cols(
                            zh_name=row.leader_zh_name,
                            nickname=row.leader_nickname,
                            email=row.leader_email,
                        ),
                        avatar_url=row.leader_avatar_url,
                    ),
                ),
                rank=start_rank + offset,
                points=int(row.points),
                week_points=int(row.week_points),
            ),
        )

    next_cursor: str | None = None
    if len(rows) > limit and page:
        last = page[-1]
        next_cursor = _encode_leaderboard_cursor(
            pts=int(last.points),
            eid=last.id,
            rank=start_rank + len(page) - 1,
        )
    return Paginated[TeamLeaderboardEntry](items=items, next_cursor=next_cursor)


def _derive_name_from_cols(*, zh_name: str | None, nickname: str | None, email: str) -> str:
    """Inline equivalent of ``services.user.derive_user_name`` for the
    leaderboard's projected row shape (we don't hydrate a full UserRow
    in SQL). Kept in sync with that function; if the fallback chain
    changes, update both.
    """
    if zh_name:
        return zh_name
    if nickname:
        return nickname
    return email.split("@", 1)[0]


__all__ = [
    "derive_user_name",  # re-exported so existing imports (tests) keep resolving
    "leaderboard_teams",
    "leaderboard_users",
]
