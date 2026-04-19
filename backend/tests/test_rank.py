from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.helpers import sign_in_and_complete

_INTEREST = {
    "form_type": "interest",
    "name": "Jet",
    "phone": "912345678",
    "interests": ["x"],
    "skills": [],
    "availability": ["週末"],
}


async def test_rank_users_sorts_by_points_desc(
    client: AsyncClient, seeded_task_defs
) -> None:
    h_jet, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    await client.post(f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit", json=_INTEREST, headers=h_jet)
    await sign_in_and_complete(client, "wei@example.com", "偉")

    response = await client.get("/api/v1/rank/users?period=all_time", headers=h_jet)
    assert response.status_code == 200
    items = response.json()["items"]
    assert items[0]["user"]["display_id"]
    assert len(items) == 2
    assert items[0]["points"] == 50
    assert items[0]["rank"] == 1
    assert items[1]["points"] == 0
    assert items[1]["rank"] == 2


async def test_rank_users_over_max_limit_422(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/rank/users?limit=101", headers=h)
    assert response.status_code == 422


async def test_rank_teams_zero_when_no_completions(
    client: AsyncClient, seeded_task_defs
) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/rank/teams", headers=h)
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) >= 1
    assert items[0]["points"] == 0


async def test_rank_users_cursor_walks_to_end(
    client: AsyncClient, seeded_task_defs
) -> None:
    h1, *_ = await sign_in_and_complete(client, "a@example.com", "A")
    await sign_in_and_complete(client, "b@example.com", "B")
    await sign_in_and_complete(client, "c@example.com", "C")

    seen_ids: list[str] = []
    cursor: str | None = None
    for _ in range(4):
        url = "/api/v1/rank/users?period=all_time&limit=1"
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


async def test_rank_users_week_filters_out_old_completions(
    session: AsyncSession, client: AsyncClient, seeded_task_defs
) -> None:
    """Completion >7 days old must appear in all_time but NOT in week.

    The plan's `_user_points_map` branches on period via `_since()`. Without this
    test, the period filter could be silently deleted.
    """
    from datetime import datetime, timedelta, timezone
    from backend.db.models import TaskProgressRow

    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    session.add(TaskProgressRow(
        user_id=jet.user_id,
        task_def_id=seeded_task_defs["T1"].id,
        status="completed",
        progress=1.0,
        completed_at=datetime.now(timezone.utc) - timedelta(days=10),
    ))
    await session.commit()

    week = (await client.get(
        "/api/v1/rank/users?period=week", headers=jet.headers
    )).json()
    all_time = (await client.get(
        "/api/v1/rank/users?period=all_time", headers=jet.headers
    )).json()

    jet_week = next(i for i in week["items"] if i["user"]["id"] == str(jet.user_id))
    jet_all = next(i for i in all_time["items"] if i["user"]["id"] == str(jet.user_id))
    assert jet_week["points"] == 0
    assert jet_all["points"] == 50
    assert jet_all["week_points"] == 0


async def test_rank_users_garbage_cursor_returns_400(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.get(
        "/api/v1/rank/users?cursor=not-a-real-cursor", headers=jet.headers
    )
    assert r.status_code == 400


async def test_rank_users_wrong_shape_cursor_returns_400(client: AsyncClient) -> None:
    """A cursor whose payload shape is wrong must 400, not 500."""
    from backend.services.pagination import encode_cursor
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    wrong = encode_cursor([True, "2026-04-18T00:00:00+00:00", "not-a-uuid"])
    r = await client.get(
        f"/api/v1/rank/users?cursor={wrong}", headers=jet.headers
    )
    assert r.status_code == 400


async def test_rank_users_ties_break_by_user_id(
    session: AsyncSession, client: AsyncClient, seeded_task_defs
) -> None:
    """Users with equal points must sort deterministically by str(id) ascending."""
    a = await sign_in_and_complete(client, "a@example.com", "A")
    b = await sign_in_and_complete(client, "b@example.com", "B")
    for u in (a, b):
        await client.post(f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit",
                          json=_INTEREST, headers=u.headers)
    data = (await client.get("/api/v1/rank/users?period=all_time", headers=a.headers)).json()
    ids = [i["user"]["id"] for i in data["items"]]
    assert ids == sorted(ids)
