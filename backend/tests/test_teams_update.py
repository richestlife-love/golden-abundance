from uuid import uuid4

from httpx import AsyncClient

from tests.helpers import sign_in_and_complete


async def test_leader_can_update_topic_and_alias(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")

    original = (await client.get(f"/api/v1/teams/{jet.led_team_id}", headers=jet.headers)).json()
    original_name = original["name"]

    response = await client.patch(
        f"/api/v1/teams/{jet.led_team_id}",
        json={"topic": "長者陪伴", "alias": "金富有小隊"},
        headers=jet.headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["topic"] == "長者陪伴"
    assert data["alias"] == "金富有小隊"
    assert data["name"] == original_name, "PATCH with only topic/alias must not wipe name"


async def test_non_leader_cannot_update(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    response = await client.patch(
        f"/api/v1/teams/{jet.led_team_id}", json={"topic": "hack"}, headers=out.headers
    )
    assert response.status_code == 403


async def test_patch_team_rejects_unknown_field(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.patch(
        f"/api/v1/teams/{jet.led_team_id}",
        json={"foo": "bar"},
        headers=jet.headers,
    )
    assert r.status_code == 422


async def test_patch_unknown_team_404(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.patch(
        f"/api/v1/teams/{uuid4()}",
        json={"topic": "x"},
        headers=jet.headers,
    )
    assert r.status_code == 404
