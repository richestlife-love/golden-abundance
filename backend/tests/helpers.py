"""Shared test helpers.

Keep small. Anything reusable across 3+ test modules lives here.
"""

from typing import NamedTuple
from uuid import UUID

from httpx import AsyncClient

_BASE_PROFILE = {
    "zh_name": "X",
    "phone": "1",
    "phone_code": "+886",
    "country": "台灣",
    "location": "台北",
}


class SignedInUser(NamedTuple):
    """Result of `sign_in_and_complete` — the three IDs downstream tests need."""

    headers: dict[str, str]
    user_id: UUID
    led_team_id: UUID


async def sign_in(client: AsyncClient, email: str) -> dict[str, str]:
    """Sign in via the stub. Returns bearer-auth headers."""
    r = await client.post("/api/v1/auth/google", json={"id_token": email})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def sign_in_and_complete(
    client: AsyncClient, email: str, zh_name: str = "X"
) -> SignedInUser:
    """Sign in + complete profile (auto-creates led team). Returns
    headers, user_id, and the auto-created led_team_id."""
    headers = await sign_in(client, email)
    body = {**_BASE_PROFILE, "zh_name": zh_name}
    response = await client.post("/api/v1/me/profile", json=body, headers=headers)
    payload = response.json()
    return SignedInUser(
        headers=headers,
        user_id=UUID(payload["user"]["id"]),
        led_team_id=UUID(payload["led_team"]["id"]),
    )
