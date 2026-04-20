from httpx import AsyncClient

from tests.helpers import sign_in, sign_in_and_complete


async def test_get_me_teams_led_only_when_fresh(client: AsyncClient) -> None:
    signed_in = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/me/teams", headers=signed_in.headers)
    assert response.status_code == 200
    data = response.json()
    assert data["led"] is not None
    assert data["joined"] is None
    assert data["led"]["role"] == "leader"


async def test_get_me_teams_both_null_before_profile(
    client: AsyncClient,
) -> None:
    headers = await sign_in(client, "noprof@example.com")
    response = await client.get("/api/v1/me/teams", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["led"] is None
    assert data["joined"] is None


async def test_get_me_teams_populates_joined_for_approved_member(
    client: AsyncClient,
) -> None:
    """Every completed profile auto-creates a led team, so `led` is always
    populated alongside `joined` for an approved member. This pins the
    shape: role on `joined` is `member`, and `joined.id` equals the
    leader's team id.
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

    response = await client.get("/api/v1/me/teams", headers=member.headers)
    assert response.status_code == 200
    data = response.json()
    assert data["joined"] is not None
    assert data["joined"]["id"] == str(leader.led_team_id)
    assert data["joined"]["role"] == "member"
