from uuid import uuid4

from httpx import AsyncClient

from tests.helpers import sign_in_and_complete


async def test_leader_cannot_leave_own_team(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/leave", headers=jet.headers
    )
    assert response.status_code == 403


async def test_member_can_leave(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    req = (
        await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
        )
    ).json()
    await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/approve",
        headers=jet.headers,
    )

    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/leave", headers=out.headers
    )
    assert response.status_code == 204

    # Caller's joined team is now null
    me_teams = await client.get("/api/v1/me/teams", headers=out.headers)
    assert me_teams.json()["joined"] is None


async def test_leave_unknown_team_404(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.post(
        f"/api/v1/teams/{uuid4()}/leave",
        headers=jet.headers,
    )
    assert r.status_code == 404
