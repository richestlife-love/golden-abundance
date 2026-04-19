from httpx import AsyncClient

from tests.helpers import sign_in

_PROFILE_BODY = {
    "zh_name": "簡傑特",
    "en_name": "Jet Kan",
    "nickname": "Jet",
    "phone": "912345678",
    "phone_code": "+886",
    "line_id": "jetkan",
    "telegram_id": None,
    "country": "台灣",
    "location": "台北",
}


async def test_post_profile_sets_flag_and_creates_led_team(client: AsyncClient) -> None:
    headers = await sign_in(client, "jet@example.com")
    response = await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["profile_complete"] is True
    assert data["user"]["zh_name"] == "簡傑特"
    assert data["led_team"]["leader"]["id"] == data["user"]["id"]
    assert data["led_team"]["display_id"].startswith("T-")


async def test_post_profile_is_one_shot(client: AsyncClient) -> None:
    headers = await sign_in(client, "jet@example.com")
    await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    second = await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    assert second.status_code == 409


async def test_patch_me_partial_update(client: AsyncClient) -> None:
    headers = await sign_in(client, "jet@example.com")
    await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    response = await client.patch(
        "/api/v1/me", json={"nickname": "JetNew"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["nickname"] == "JetNew"
    assert response.json()["zh_name"] == "簡傑特"  # untouched
