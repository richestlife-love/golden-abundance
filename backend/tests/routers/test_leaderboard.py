from datetime import UTC

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.helpers import INTEREST_SUBMIT_BODY, sign_in_and_complete


async def test_leaderboard_users_sorts_by_points_desc(client: AsyncClient, seeded_task_defs) -> None:
    h_jet, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    await client.post(
        f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit",
        json=INTEREST_SUBMIT_BODY,
        headers=h_jet,
    )
    await sign_in_and_complete(client, "wei@example.com", "偉")

    response = await client.get("/api/v1/leaderboard/users?period=all_time", headers=h_jet)
    assert response.status_code == 200
    items = response.json()["items"]
    assert items[0]["user"]["display_id"]
    assert len(items) == 2
    assert items[0]["points"] == 50
    assert items[0]["rank"] == 1
    assert items[1]["points"] == 0
    assert items[1]["rank"] == 2


async def test_leaderboard_users_over_max_limit_422(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/leaderboard/users?limit=101", headers=h)
    assert response.status_code == 422


async def test_leaderboard_teams_zero_when_no_completions(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/leaderboard/teams", headers=h)
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) >= 1
    assert items[0]["points"] == 0


async def test_leaderboard_users_cursor_walks_to_end(client: AsyncClient, seeded_task_defs) -> None:
    h1, *_ = await sign_in_and_complete(client, "a@example.com", "A")
    await sign_in_and_complete(client, "b@example.com", "B")
    await sign_in_and_complete(client, "c@example.com", "C")

    seen_ids: list[str] = []
    cursor: str | None = None
    for _ in range(4):
        url = "/api/v1/leaderboard/users?period=all_time&limit=1"
        if cursor:
            url += f"&cursor={cursor}"
        response = await client.get(url, headers=h1)
        assert response.status_code == 200
        data = response.json()
        seen_ids.extend(item["user"]["id"] for item in data["items"])
        cursor = data["next_cursor"]
        if cursor is None:
            break
    assert cursor is None
    assert len(seen_ids) == 3
    assert len(set(seen_ids)) == 3


async def test_leaderboard_users_week_filters_out_old_completions(
    session: AsyncSession,
    client: AsyncClient,
    seeded_task_defs,
) -> None:
    """Completion >7 days old must appear in all_time but NOT in week.

    The plan's `_user_points_map` branches on period via `_since()`. Without this
    test, the period filter could be silently deleted.
    """
    from datetime import datetime, timedelta

    from backend.db.models import TaskProgressRow

    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    session.add(
        TaskProgressRow(
            user_id=jet.user_id,
            task_def_id=seeded_task_defs["T1"].id,
            status="completed",
            progress=1.0,
            completed_at=datetime.now(UTC) - timedelta(days=10),
        ),
    )
    await session.commit()

    week = (await client.get("/api/v1/leaderboard/users?period=week", headers=jet.headers)).json()
    all_time = (await client.get("/api/v1/leaderboard/users?period=all_time", headers=jet.headers)).json()

    jet_week = next(i for i in week["items"] if i["user"]["id"] == str(jet.user_id))
    jet_all = next(i for i in all_time["items"] if i["user"]["id"] == str(jet.user_id))
    assert jet_week["points"] == 0
    assert jet_all["points"] == 50
    assert jet_all["week_points"] == 0


async def test_leaderboard_users_garbage_cursor_returns_400(
    client: AsyncClient,
) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.get("/api/v1/leaderboard/users?cursor=not-a-real-cursor", headers=jet.headers)
    assert r.status_code == 400


async def test_leaderboard_users_wrong_shape_cursor_returns_400(
    client: AsyncClient,
) -> None:
    """A cursor whose payload shape is wrong must 400, not 500."""
    from backend.services.pagination import encode_cursor

    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    wrong = encode_cursor([True, "2026-04-18T00:00:00+00:00", "not-a-uuid"])
    r = await client.get(f"/api/v1/leaderboard/users?cursor={wrong}", headers=jet.headers)
    assert r.status_code == 400


async def test_leaderboard_users_ties_break_by_user_id(
    session: AsyncSession,
    client: AsyncClient,
    seeded_task_defs,
) -> None:
    """Users with equal points must sort deterministically by str(id) ascending."""
    a = await sign_in_and_complete(client, "a@example.com", "A")
    b = await sign_in_and_complete(client, "b@example.com", "B")
    for u in (a, b):
        await client.post(
            f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit",
            json=INTEREST_SUBMIT_BODY,
            headers=u.headers,
        )
    data = (await client.get("/api/v1/leaderboard/users?period=all_time", headers=a.headers)).json()
    ids = [i["user"]["id"] for i in data["items"]]
    assert ids == sorted(ids)


async def test_leaderboard_users_period_month_returns_200(client: AsyncClient) -> None:
    """Pins the ``month`` branch of ``_since()`` so a future period-enum
    change doesn't silently drop 30-day filtering.
    """
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.get("/api/v1/leaderboard/users?period=month", headers=jet.headers)
    assert r.status_code == 200


async def test_leaderboard_users_cursor_past_end_returns_empty_page(client: AsyncClient) -> None:
    """A cursor whose (pts, id) tuple is strictly past every entry must
    yield an empty page, not a 500.
    """
    from backend.services.pagination import encode_cursor

    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    # No user has pts < -1 (pts >= 0 always), and no user has pts == -1,
    # so the keyset WHERE filter yields zero rows.
    past_end = encode_cursor(
        {"pts": -1, "id": "ffffffff-ffff-ffff-ffff-ffffffffffff", "rank": 1000},
    )
    r = await client.get(f"/api/v1/leaderboard/users?cursor={past_end}", headers=jet.headers)
    assert r.status_code == 200
    data = r.json()
    assert data["items"] == []
    assert data["next_cursor"] is None


async def test_leaderboard_teams_empty_when_zero_teams(client: AsyncClient) -> None:
    """No profile → no auto-created led team → zero teams in DB.
    The early-return branch in ``leaderboard_teams`` must return an
    empty page without executing the membership query.
    """
    from tests.helpers import sign_in

    headers = await sign_in(client, "noprof@example.com")
    r = await client.get("/api/v1/leaderboard/teams", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["items"] == []
    assert data["next_cursor"] is None


async def test_leaderboard_teams_includes_approved_member_points(client: AsyncClient, seeded_task_defs) -> None:
    """A team with an approved (non-leader) member must include that
    member's points in the team total. Pins the membership-grouping
    loop in ``leaderboard_teams`` that builds ``team_member_ids``.
    """
    leader = await sign_in_and_complete(client, "lead@example.com", "領")
    member = await sign_in_and_complete(client, "mem@example.com", "員")
    req = (
        await client.post(
            f"/api/v1/teams/{leader.led_team_id}/join-requests",
            headers=member.headers,
        )
    ).json()
    approve = await client.post(
        f"/api/v1/teams/{leader.led_team_id}/join-requests/{req['id']}/approve",
        headers=leader.headers,
    )
    assert approve.status_code == 200

    # Only the member submits — team total must reflect the member's 50 pts.
    await client.post(
        f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit",
        json=INTEREST_SUBMIT_BODY,
        headers=member.headers,
    )
    data = (await client.get("/api/v1/leaderboard/teams?period=all_time", headers=leader.headers)).json()
    leader_team = next(i for i in data["items"] if i["team"]["id"] == str(leader.led_team_id))
    assert leader_team["points"] == 50


async def test_leaderboard_users_ranking_is_stable_across_pages(
    client: AsyncClient,
    seeded_task_defs,
) -> None:
    """Paginating through the leaderboard must produce contiguous,
    unique, strictly-increasing ranks — and keyset pagination must
    return the same ordering as a single-page fetch.

    Regression guard for the SQL-side ranking rewrite: the previous
    implementation sorted in Python after loading every user; the SQL
    version must preserve this ordering when paginated via cursor.
    """
    # Three users, one submits a scoring task so there's a non-trivial
    # order. Small page size to exercise cursor pagination.
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    await client.post(
        f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit",
        json=INTEREST_SUBMIT_BODY,
        headers=jet.headers,
    )
    await sign_in_and_complete(client, "wei@example.com", "偉")
    await sign_in_and_complete(client, "mei@example.com", "美")

    # One-shot fetch (baseline).
    full = (
        await client.get(
            "/api/v1/leaderboard/users?period=all_time&limit=50",
            headers=jet.headers,
        )
    ).json()
    full_ids = [entry["user"]["id"] for entry in full["items"]]
    full_ranks = [entry["rank"] for entry in full["items"]]
    assert full_ranks == list(range(1, len(full_ranks) + 1))

    # Paginated fetch (limit=1 per page).
    paginated_ids: list[str] = []
    paginated_ranks: list[int] = []
    cursor: str | None = None
    while True:
        url = "/api/v1/leaderboard/users?period=all_time&limit=1"
        if cursor is not None:
            url += f"&cursor={cursor}"
        page = (await client.get(url, headers=jet.headers)).json()
        for entry in page["items"]:
            paginated_ids.append(entry["user"]["id"])
            paginated_ranks.append(entry["rank"])
        cursor = page["next_cursor"]
        if cursor is None:
            break

    assert paginated_ids == full_ids, "paginated order must match single-page order"
    assert paginated_ranks == full_ranks, "ranks must be continuous across pages"
