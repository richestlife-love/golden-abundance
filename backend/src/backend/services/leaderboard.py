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

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
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


def _since(period: LeaderboardPeriod) -> datetime | None:
    now = datetime.now(UTC)
    if period == "week":
        return now - timedelta(days=7)
    if period == "month":
        return now - timedelta(days=30)
    return None


async def _user_points_window_and_week(session: AsyncSession, period: LeaderboardPeriod) -> dict[UUID, tuple[int, int]]:
    """Return ``{user_id: (window_pts, week_pts)}`` in a single round-trip.

    ``window_pts`` sums points earned inside the requested ``period``'s
    window (all-time, 7d, or 30d). ``week_pts`` always sums the last 7
    days regardless of ``period`` — entries need both so the UI can show
    "X pts (week: Y)" without a second query.

    Both aggregates use Postgres ``SUM(...) FILTER (WHERE ...)`` when a
    window bound applies, so we read ``task_progress`` exactly once
    instead of twice.
    """
    now = datetime.now(UTC)
    week_start = now - timedelta(days=7)
    window_start = _since(period)

    week_sum = func.coalesce(
        func.sum(TaskDefRow.points).filter(TaskProgressRow.completed_at >= week_start),
        0,
    ).label("week_pts")
    if window_start is None:
        window_sum = func.coalesce(func.sum(TaskDefRow.points), 0).label("window_pts")
    else:
        window_sum = func.coalesce(
            func.sum(TaskDefRow.points).filter(TaskProgressRow.completed_at >= window_start),
            0,
        ).label("window_pts")

    stmt = (
        select(
            TaskProgressRow.user_id,
            window_sum,
            week_sum,
        )
        .join(TaskDefRow, TaskDefRow.id == TaskProgressRow.task_def_id)
        .where(TaskProgressRow.status == "completed")
        .group_by(TaskProgressRow.user_id)
    )
    rows = (await session.execute(stmt)).all()
    return {uid: (int(w), int(wk)) for uid, w, wk in rows}


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
            raise InvalidCursorError(f"leaderboard cursor missing/invalid pts/id: {exc}") from exc
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
    session: AsyncSession,
    *,
    period: LeaderboardPeriod,
    cursor: str | None,
    limit: int,
) -> Paginated[UserLeaderboardEntry]:
    pts_by_user = await _user_points_window_and_week(session, period)

    users = {u.id: u for u in (await session.execute(select(UserRow))).scalars().all()}
    all_entries: list[tuple[int, UUID]] = sorted(
        ((pts_by_user.get(uid, (0, 0))[0], uid) for uid in users),
        key=lambda kv: (-kv[0], str(kv[1])),
    )
    page, start_idx, next_cursor = _slice_after_cursor(all_entries, cursor, limit)

    items: list[UserLeaderboardEntry] = []
    for offset, (pts, uid) in enumerate(page):
        u = users[uid]
        _, week_pts = pts_by_user.get(uid, (0, 0))
        items.append(
            UserLeaderboardEntry(
                user=UserRef(
                    id=u.id,
                    display_id=u.display_id,
                    name=derive_user_name(u),
                    avatar_url=u.avatar_url,
                ),
                rank=start_idx + offset + 1,
                points=pts,
                week_points=week_pts,
            ),
        )
    return Paginated[UserLeaderboardEntry](items=items, next_cursor=next_cursor)


async def leaderboard_teams(
    session: AsyncSession,
    *,
    period: LeaderboardPeriod,
    cursor: str | None,
    limit: int,
) -> Paginated[TeamLeaderboardEntry]:
    pts_by_user = await _user_points_window_and_week(session, period)

    teams = (await session.execute(select(TeamRow))).scalars().all()
    if not teams:
        return Paginated[TeamLeaderboardEntry](items=[], next_cursor=None)

    # Batch-load every team's memberships in one query, then group by
    # team_id. Avoids the per-team SELECT the previous loop did.
    team_ids = [t.id for t in teams]
    membership_rows = (
        await session.execute(
            select(TeamMembershipRow.team_id, TeamMembershipRow.user_id).where(TeamMembershipRow.team_id.in_(team_ids)),
        )
    ).all()
    team_member_ids: dict[UUID, list[UUID]] = {t.id: [t.leader_id] for t in teams}
    for team_id, user_id in membership_rows:
        team_member_ids[team_id].append(user_id)

    totals: dict[UUID, int] = {
        tid: sum(pts_by_user.get(uid, (0, 0))[0] for uid in uids) for tid, uids in team_member_ids.items()
    }
    week_totals: dict[UUID, int] = {
        tid: sum(pts_by_user.get(uid, (0, 0))[1] for uid in uids) for tid, uids in team_member_ids.items()
    }

    all_entries: list[tuple[int, UUID]] = sorted(
        ((pts, tid) for tid, pts in totals.items()),
        key=lambda kv: (-kv[0], str(kv[1])),
    )
    page, start_idx, next_cursor = _slice_after_cursor(all_entries, cursor, limit)

    team_by_id = {t.id: t for t in teams}
    leaders = {
        u.id: u
        for u in (await session.execute(select(UserRow).where(UserRow.id.in_([t.leader_id for t in teams]))))
        .scalars()
        .all()
    }

    items: list[TeamLeaderboardEntry] = []
    for offset, (pts, tid) in enumerate(page):
        t = team_by_id[tid]
        leader = leaders[t.leader_id]
        items.append(
            TeamLeaderboardEntry(
                team=TeamRef(
                    id=t.id,
                    display_id=t.display_id,
                    name=t.name,
                    topic=t.topic,
                    leader=UserRef(
                        id=leader.id,
                        display_id=leader.display_id,
                        name=derive_user_name(leader),
                        avatar_url=leader.avatar_url,
                    ),
                ),
                rank=start_idx + offset + 1,
                points=pts,
                week_points=week_totals.get(tid, 0),
            ),
        )
    return Paginated[TeamLeaderboardEntry](items=items, next_cursor=next_cursor)
