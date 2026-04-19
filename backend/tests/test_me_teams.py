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


async def test_get_me_teams_both_null_before_profile(client: AsyncClient) -> None:
    headers = await sign_in(client, "noprof@example.com")
    response = await client.get("/api/v1/me/teams", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["led"] is None
    assert data["joined"] is None
