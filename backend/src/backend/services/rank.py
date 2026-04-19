"""Leaderboard queries. Computes points dynamically from completed
task progress rows. Fine for Phase-5 data volume; denormalize to
UserRow.points / TeamRow.points columns if the view ever gets slow.

The ``next_cursor`` is an opaque base64(JSON) of the last-returned
entry's ``(points, id)`` tuple. The next page filters by
``(points < cursor_points) OR (points == cursor_points AND id > cursor_id)``
— which, under our ORDER BY ``points DESC, id ASC``, is strict
"after-cursor" ordering. This is stable under concurrent writes: a
given row's ``id`` never changes and its ``points`` only changes when
that user/team earns new points, so the cursor boundary is well-defined
per row rather than per offset.

For Phase-5 data volume we still rank in Python after loading rows;
denormalize to a window-function SQL query if the set ever grows past
a few thousand.

TODO(phase-6): rewrite as a single SQL with
``ROW_NUMBER() OVER (ORDER BY points DESC, id ASC)`` projected as
``rank``, then keyset-paginate using ``services.pagination.paginate_keyset``
over ``(points DESC, id ASC)``. That removes the "load every user/team
into Python" pattern and scales to 10k+ rows.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import (
    Paginated,
    RankPeriod,
    TeamRankEntry,
    TeamRef,
    UserRankEntry,
    UserRef,
)
from backend.db.models import (
    TaskDefRow,
    TaskProgressRow,
    TeamMembershipRow,
    TeamRow,
    UserRow,
)
from backend.services.pagination import InvalidCursor, decode_cursor, encode_cursor


def _since(period: RankPeriod) -> datetime | None:
    now = datetime.now(timezone.utc)
    if period == "week":
        return now - timedelta(days=7)
    if period == "month":
        return now - timedelta(days=30)
    return None


async def _user_points_map(
    session: AsyncSession, period: RankPeriod
) -> dict[UUID, int]:
    stmt = (
        select(
            TaskProgressRow.user_id,
            func.coalesce(func.sum(TaskDefRow.points), 0).label("pts"),
        )
        .join(TaskDefRow, TaskDefRow.id == TaskProgressRow.task_def_id)
        .where(TaskProgressRow.status == "completed")
        .group_by(TaskProgressRow.user_id)
    )
    since = _since(period)
    if since is not None:
        stmt = stmt.where(TaskProgressRow.completed_at >= since)
    rows = (await session.execute(stmt)).all()
    return {uid: int(pts) for uid, pts in rows}


def _slice_after_cursor(
    sorted_entries: list[tuple[int, UUID]],
    cursor: str | None,
    limit: int,
) -> tuple[list[tuple[int, UUID]], int, str | None]:
    """Slice ``sorted_entries`` (points desc, id asc) starting strictly
    after the cursor. Returns ``(page, start_idx, next_cursor)``.

    The cursor is opaque base64(JSON of ``{pts, id}``). A row is "after
    the cursor" iff ``pts < cursor_pts`` OR
    ``pts == cursor_pts AND str(id) > str(cursor_id)``.
    """
    start_idx = 0
    if cursor is not None:
        payload = decode_cursor(cursor)
        try:
            cursor_pts = int(payload["pts"])
            cursor_id_str = str(payload["id"])
        except (KeyError, TypeError, ValueError) as exc:
            raise InvalidCursor(
                f"rank cursor missing/invalid pts/id: {exc}"
            ) from exc
        for idx, (pts, eid) in enumerate(sorted_entries):
            if pts < cursor_pts or (pts == cursor_pts and str(eid) > cursor_id_str):
                start_idx = idx
                break
        else:
            start_idx = len(sorted_entries)

    page = sorted_entries[start_idx : start_idx + limit]
    next_cursor: str | None = None
    if start_idx + limit < len(sorted_entries) and page:
        last_pts, last_id = page[-1]
        next_cursor = encode_cursor({"pts": int(last_pts), "id": str(last_id)})
    return page, start_idx, next_cursor


async def leaderboard_users(
    session: AsyncSession, *, period: RankPeriod, cursor: str | None, limit: int
) -> Paginated[UserRankEntry]:
    window_pts = await _user_points_map(session, period)
    week_pts = window_pts if period == "week" else await _user_points_map(session, "week")

    users = {
        u.id: u
        for u in (await session.execute(select(UserRow))).scalars().all()
    }
    all_entries: list[tuple[int, UUID]] = sorted(
        ((window_pts.get(uid, 0), uid) for uid in users),
        key=lambda kv: (-kv[0], str(kv[1])),
    )
    page, start_idx, next_cursor = _slice_after_cursor(all_entries, cursor, limit)

    items: list[UserRankEntry] = []
    for offset, (pts, uid) in enumerate(page):
        u = users[uid]
        name = u.zh_name or u.nickname or u.email.split("@", 1)[0]
        items.append(
            UserRankEntry(
                user=UserRef(
                    id=u.id,
                    display_id=u.display_id,
                    name=name,
                    avatar_url=u.avatar_url,
                ),
                rank=start_idx + offset + 1,
                points=pts,
                week_points=week_pts.get(uid, 0),
            )
        )
    return Paginated[UserRankEntry](items=items, next_cursor=next_cursor)


async def leaderboard_teams(
    session: AsyncSession, *, period: RankPeriod, cursor: str | None, limit: int
) -> Paginated[TeamRankEntry]:
    window_pts_by_user = await _user_points_map(session, period)
    week_pts_by_user = (
        window_pts_by_user if period == "week" else await _user_points_map(session, "week")
    )

    teams = (await session.execute(select(TeamRow))).scalars().all()
    if not teams:
        return Paginated[TeamRankEntry](items=[], next_cursor=None)

    team_member_ids: dict[UUID, list[UUID]] = {}
    for team in teams:
        mems = (
            await session.execute(
                select(TeamMembershipRow.user_id).where(
                    TeamMembershipRow.team_id == team.id
                )
            )
        ).all()
        team_member_ids[team.id] = [team.leader_id] + [m[0] for m in mems]

    totals: dict[UUID, int] = {
        tid: sum(window_pts_by_user.get(uid, 0) for uid in uids)
        for tid, uids in team_member_ids.items()
    }
    week_totals: dict[UUID, int] = {
        tid: sum(week_pts_by_user.get(uid, 0) for uid in uids)
        for tid, uids in team_member_ids.items()
    }

    all_entries: list[tuple[int, UUID]] = sorted(
        ((pts, tid) for tid, pts in totals.items()),
        key=lambda kv: (-kv[0], str(kv[1])),
    )
    page, start_idx, next_cursor = _slice_after_cursor(all_entries, cursor, limit)

    team_by_id = {t.id: t for t in teams}
    leaders = {
        u.id: u
        for u in (
            await session.execute(
                select(UserRow).where(
                    UserRow.id.in_([t.leader_id for t in teams])
                )
            )
        ).scalars().all()
    }

    items: list[TeamRankEntry] = []
    for offset, (pts, tid) in enumerate(page):
        t = team_by_id[tid]
        leader = leaders[t.leader_id]
        leader_name = leader.zh_name or leader.nickname or leader.email.split("@", 1)[0]
        items.append(
            TeamRankEntry(
                team=TeamRef(
                    id=t.id,
                    display_id=t.display_id,
                    name=t.name,
                    topic=t.topic,
                    leader=UserRef(
                        id=leader.id,
                        display_id=leader.display_id,
                        name=leader_name,
                        avatar_url=leader.avatar_url,
                    ),
                ),
                rank=start_idx + offset + 1,
                points=pts,
                week_points=week_totals.get(tid, 0),
            )
        )
    return Paginated[TeamRankEntry](items=items, next_cursor=next_cursor)
