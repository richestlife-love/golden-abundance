from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.helpers import sign_in_and_complete


async def test_list_teams_returns_all(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    await sign_in_and_complete(client, "wei@example.com", "偉")

    response = await client.get("/api/v1/teams", headers=jet.headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2


async def test_list_teams_filters_by_leader_display_id(
    client: AsyncClient,
) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    me_response = await client.get("/api/v1/me", headers=jet.headers)
    jet_display_id = me_response.json()["display_id"]
    await sign_in_and_complete(client, "wei@example.com", "偉")

    response = await client.get(
        "/api/v1/teams",
        params={"leader_display_id": jet_display_id},
        headers=jet.headers,
    )
    assert len(response.json()["items"]) == 1


async def test_team_detail_leader_sees_empty_requests_list(
    client: AsyncClient,
) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")

    response = await client.get(f"/api/v1/teams/{jet.led_team_id}", headers=jet.headers)
    assert response.status_code == 200
    assert response.json()["role"] == "leader"
    assert response.json()["requests"] == []


async def test_team_detail_outsider_sees_null_requests(
    client: AsyncClient,
) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")

    response = await client.get(f"/api/v1/teams/{jet.led_team_id}", headers=out.headers)
    assert response.status_code == 200
    assert response.json()["role"] is None
    assert response.json()["requests"] is None


async def test_team_detail_404(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get(f"/api/v1/teams/{uuid4()}", headers=jet.headers)
    assert response.status_code == 404


async def test_team_detail_rank_is_null(client: AsyncClient) -> None:
    """Spec §Leaderboard: ``Team.rank`` is populated only by the
    leaderboard queries. The bare ``GET /teams/{id}`` response must
    return ``rank=null`` so UIs know not to render a position here.
    """
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get(f"/api/v1/teams/{jet.led_team_id}", headers=jet.headers)
    assert response.status_code == 200
    assert response.json()["rank"] is None


async def test_team_detail_member_sees_null_requests(
    client: AsyncClient,
) -> None:
    """Non-leader members must see `requests = null`, not the pending-request list."""
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")

    req = (
        await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests",
            headers=out.headers,
        )
    ).json()
    await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/approve",
        headers=jet.headers,
    )
    response = await client.get(f"/api/v1/teams/{jet.led_team_id}", headers=out.headers)
    data = response.json()
    assert data["role"] == "member"
    assert data["requests"] is None


async def test_list_teams_cursor_walks_to_end(client: AsyncClient) -> None:
    # Three led teams (auto-created by sign_in_and_complete). Pagination
    # size=1 walks all three across three calls and reports next_cursor=None
    # on the last. Exercises the (created_at, id) keyset filter — if the
    # WHERE only considered id (ignoring created_at), this would drop or
    # duplicate rows because UUIDs are random.
    h1 = (await sign_in_and_complete(client, "a@example.com", "A")).headers
    await sign_in_and_complete(client, "b@example.com", "B")
    await sign_in_and_complete(client, "c@example.com", "C")

    seen_ids: list[str] = []
    cursor: str | None = None
    for _ in range(4):  # 3 pages + guard against infinite loop
        url = "/api/v1/teams?limit=1"
        if cursor:
            url += f"&cursor={cursor}"
        response = await client.get(url, headers=h1)
        assert response.status_code == 200
        data = response.json()
        seen_ids.extend(item["id"] for item in data["items"])
        cursor = data["next_cursor"]
        if cursor is None:
            break
    assert cursor is None
    assert len(seen_ids) == 3
    assert len(set(seen_ids)) == 3  # no dups across pages


async def test_list_teams_malformed_cursor_400(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/teams?cursor=not-a-real-cursor!!!", headers=jet.headers)
    assert response.status_code == 400


@pytest.mark.parametrize(
    ("payload", "case"),
    [
        ([None], "wrong-length-list"),
        ({"created_at": "2026-01-01T00:00:00+00:00", "id": "x"}, "dict-not-list"),
    ],
)
async def test_list_teams_wrong_shape_cursor_400(client: AsyncClient, payload, case: str) -> None:
    """A well-formed cursor whose decoded payload doesn't match the sort
    shape (len != 2, or not a list at all) must 400, not 500. GET /teams
    sorts by (created_at, id) — two columns.
    """
    from backend.services.pagination import encode_cursor

    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    wrong = encode_cursor(payload)
    response = await client.get(f"/api/v1/teams?cursor={wrong}", headers=jet.headers)
    assert response.status_code == 400, f"{case}: {response.text}"
