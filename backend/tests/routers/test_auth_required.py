"""401 handling + upsert-on-first-auth coverage for current_user."""

from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/api/v1/me/profile"),
        ("PATCH", "/api/v1/me"),
        ("GET", "/api/v1/me/teams"),
        ("GET", "/api/v1/teams"),
        ("GET", f"/api/v1/teams/{uuid4()}"),
        ("PATCH", f"/api/v1/teams/{uuid4()}"),
        ("POST", f"/api/v1/teams/{uuid4()}/join-requests"),
        ("POST", f"/api/v1/teams/{uuid4()}/join-requests/{uuid4()}/approve"),
        ("POST", f"/api/v1/teams/{uuid4()}/join-requests/{uuid4()}/reject"),
        ("DELETE", f"/api/v1/teams/{uuid4()}/join-requests/{uuid4()}"),
        ("POST", f"/api/v1/teams/{uuid4()}/leave"),
    ],
)
async def test_endpoint_requires_auth(client: AsyncClient, method: str, path: str) -> None:
    r = await client.request(method, path)
    assert r.status_code == 401, f"{method} {path} should require auth"


async def test_protected_route_rejects_missing_bearer(client: AsyncClient) -> None:
    r = await client.get("/api/v1/me")
    assert r.status_code == 401


async def test_protected_route_rejects_malformed_bearer(client: AsyncClient) -> None:
    r = await client.get("/api/v1/me", headers={"Authorization": "Basic abc"})
    assert r.status_code == 401


async def test_protected_route_rejects_invalid_jwt(client: AsyncClient) -> None:
    r = await client.get("/api/v1/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401


async def test_current_user_upserts_fresh_signup(
    client: AsyncClient,
    session: AsyncSession,
    mint_access_token,
) -> None:
    """First authed request for a never-seen sub creates the UserRow."""
    from backend.db.models import UserRow

    auth_id = UUID(int=9999)
    token = mint_access_token(user_id=auth_id, email="fresh@example.com")

    r = await client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text

    row = await session.get(UserRow, auth_id)
    assert row is not None
    assert row.email == "fresh@example.com"
    assert row.profile_complete is False


async def test_current_user_is_idempotent_across_requests(
    client: AsyncClient,
    mint_access_token,
) -> None:
    auth_id = UUID(int=9998)
    token = mint_access_token(user_id=auth_id, email="repeat@example.com")

    r1 = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    r2 = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["id"] == r2.json()["id"]
    assert r1.json()["display_id"] == r2.json()["display_id"]
