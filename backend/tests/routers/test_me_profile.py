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


async def test_post_profile_sets_flag_and_creates_led_team(
    client: AsyncClient,
) -> None:
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
    response = await client.patch("/api/v1/me", json={"nickname": "JetNew"}, headers=headers)
    assert response.status_code == 200
    assert response.json()["nickname"] == "JetNew"
    assert response.json()["zh_name"] == "簡傑特"  # untouched


async def test_post_profile_rejects_overlong_zh_name(client: AsyncClient) -> None:
    headers = await sign_in(client, "jet@example.com")
    body = {**_PROFILE_BODY, "zh_name": "x" * 65}  # DB cap is 64
    response = await client.post("/api/v1/me/profile", json=body, headers=headers)
    assert response.status_code == 422


async def test_post_profile_rejects_overlong_phone(client: AsyncClient) -> None:
    headers = await sign_in(client, "jet@example.com")
    body = {**_PROFILE_BODY, "phone": "9" * 33}  # DB cap is 32
    response = await client.post("/api/v1/me/profile", json=body, headers=headers)
    assert response.status_code == 422


async def test_patch_me_rejects_empty_string(client: AsyncClient) -> None:
    headers = await sign_in(client, "jet@example.com")
    await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    r = await client.patch("/api/v1/me", json={"zh_name": ""}, headers=headers)
    assert r.status_code == 422


async def test_patch_me_rejects_overlong_nickname(client: AsyncClient) -> None:
    headers = await sign_in(client, "jet@example.com")
    await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    r = await client.patch("/api/v1/me", json={"nickname": "y" * 65}, headers=headers)
    assert r.status_code == 422


async def test_patch_me_allows_null_to_clear_optional_field(client: AsyncClient) -> None:
    """Null clears nullable fields — only empty string is rejected."""
    headers = await sign_in(client, "jet@example.com")
    await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    r = await client.patch("/api/v1/me", json={"line_id": None}, headers=headers)
    assert r.status_code == 200
    assert r.json()["line_id"] is None


async def test_patch_me_rejects_avatar_url_422(client: AsyncClient) -> None:
    """``avatar_url`` is read-only: present on the ``User`` response but
    deliberately absent from ``ProfileUpdate``. StrictModel must 422
    the write attempt instead of silently ignoring it.
    """
    headers = await sign_in(client, "jet@example.com")
    await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    r = await client.patch(
        "/api/v1/me",
        json={"avatar_url": "https://example.com/a.png"},
        headers=headers,
    )
    assert r.status_code == 422


async def test_patch_me_rejects_unknown_field(client: AsyncClient) -> None:
    """``ProfileUpdate`` inherits ``StrictModel(extra='forbid')`` —
    unknown keys must 422, not silently no-op.
    """
    headers = await sign_in(client, "jet@example.com")
    await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    r = await client.patch("/api/v1/me", json={"foo": "bar"}, headers=headers)
    assert r.status_code == 422


async def test_patch_me_rejects_profile_complete_smuggle(client: AsyncClient) -> None:
    """``profile_complete`` is set server-side by POST /me/profile only;
    a client must not be able to reset it via PATCH.
    """
    headers = await sign_in(client, "jet@example.com")
    await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    r = await client.patch("/api/v1/me", json={"profile_complete": False}, headers=headers)
    assert r.status_code == 422
