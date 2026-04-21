"""Shared test helpers.

Keep small. Anything reusable across 3+ test modules lives here.

Phase 6a: ``sign_in`` no longer hits an endpoint — it mints a
Supabase-shaped RS256 JWT and issues a single GET /me so the UserRow
is materialized with the correct Supabase sub.

The mint callable is injected per-test via the ``_bind_sign_in_mint``
autouse fixture in ``conftest.py``, so test modules don't need to
thread ``mint_access_token`` through every call site.
"""

from collections.abc import Callable
from typing import NamedTuple
from uuid import UUID, uuid4

from httpx import AsyncClient

# Per-test module-level slot populated by the ``_bind_sign_in_mint``
# fixture in ``conftest.py``. Reading this outside a test is an error.
_MINT_FN: Callable[..., str] | None = None

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


def _mint() -> Callable[..., str]:
    if _MINT_FN is None:
        raise RuntimeError(
            "sign_in called without the _bind_sign_in_mint fixture active. "
            "Check that backend/tests/conftest.py defines it and is loaded.",
        )
    return _MINT_FN


async def sign_in(
    client: AsyncClient,
    email: str,
    user_id: UUID | None = None,
) -> dict[str, str]:
    """Sign in via minted JWT. Returns bearer-auth headers.

    ``user_id`` defaults to a fresh ``uuid4()``; pass an explicit UUID when
    the test needs a stable identity across calls (e.g., to assert a row
    persists between requests).
    """
    token = _mint()(user_id=user_id or uuid4(), email=email)
    headers = {"Authorization": f"Bearer {token}"}
    # Prime the upsert so the UserRow exists before the caller exercises
    # anything non-idempotent (e.g., POST /me/profile).
    r = await client.get("/api/v1/me", headers=headers)
    assert r.status_code == 200, r.text
    return headers


async def sign_in_and_complete(
    client: AsyncClient,
    email: str,
    zh_name: str = "X",
) -> SignedInUser:
    """Sign in + complete profile (auto-creates led team). Returns
    headers, user_id, and the auto-created led_team_id.
    """
    headers = await sign_in(client, email)
    body = {**_BASE_PROFILE, "zh_name": zh_name}
    response = await client.post("/api/v1/me/profile", json=body, headers=headers)
    assert response.status_code == 200, response.text
    payload = response.json()
    return SignedInUser(
        headers=headers,
        user_id=UUID(payload["user"]["id"]),
        led_team_id=UUID(payload["led_team"]["id"]),
    )
