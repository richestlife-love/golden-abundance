import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def test_get_me_returns_current_user(client: AsyncClient) -> None:
    sign_in = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    token = sign_in.json()["access_token"]

    response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "jet@example.com"
    assert data["profile_complete"] is False
    assert data["name"] == "jet"  # email-local-part fallback


async def test_get_me_401_without_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/me")
    assert response.status_code == 401


async def test_401_when_user_was_deleted(client: AsyncClient, session: AsyncSession) -> None:
    """Valid JWT whose `sub` points at a deleted user → 401, not 200 with None."""
    from sqlalchemy import delete
    from backend.db.models import UserRow

    r = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    token = r.json()["access_token"]

    await session.execute(delete(UserRow).where(UserRow.email == "jet@example.com"))
    await session.commit()

    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


@pytest.mark.parametrize(
    "header_value",
    [
        "",  # no header at all (via missing key)
        "Basic dXNlcjpwYXNz",  # wrong scheme
        "Bearer",  # scheme-only, no token
        "Bearer ",  # empty token
        "Bearer not-a-jwt",  # garbage token
    ],
)
async def test_me_rejects_bad_bearer(client: AsyncClient, header_value: str) -> None:
    headers = {"Authorization": header_value} if header_value else {}
    r = await client.get("/api/v1/me", headers=headers)
    assert r.status_code == 401


async def test_me_rejects_expired_bearer(client: AsyncClient) -> None:
    from datetime import timedelta
    from backend.auth.jwt import encode_token
    from uuid import uuid4

    expired = encode_token(user_id=uuid4(), email="x@e.com", ttl=timedelta(seconds=-3600))
    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {expired}"})
    assert r.status_code == 401


async def test_401_sets_www_authenticate_bearer(client: AsyncClient) -> None:
    r = await client.get("/api/v1/me")
    assert r.status_code == 401
    assert r.headers.get("WWW-Authenticate") == "Bearer"


async def test_me_rejects_jwt_signed_with_wrong_secret(client: AsyncClient) -> None:
    """Router-level pin: a syntactically valid HS256 JWT with a wrong key → 401."""
    import jwt as pyjwt

    forged = pyjwt.encode(
        {"sub": "00000000-0000-0000-0000-000000000000", "email": "x@e.com", "exp": 9_999_999_999},
        "attacker-secret-32-bytes-long-padding",
        algorithm="HS256",
    )
    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


async def test_me_rejects_alg_none_jwt(client: AsyncClient) -> None:
    """Router-level pin: a `none`-alg token must not be trusted."""
    import jwt as pyjwt

    none_alg = pyjwt.encode(
        {"sub": "00000000-0000-0000-0000-000000000000", "email": "x@e.com", "exp": 9_999_999_999},
        key="",
        algorithm="none",
    )
    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {none_alg}"})
    assert r.status_code == 401


async def test_me_rejects_very_long_garbage_token(client: AsyncClient) -> None:
    """No crash / DoS on pathologically long input — clean 401."""
    r = await client.get("/api/v1/me", headers={"Authorization": "Bearer " + "a" * 10_000})
    assert r.status_code == 401
