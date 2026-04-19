import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import UserRow


async def test_google_sign_in_creates_user(client: AsyncClient, session: AsyncSession) -> None:
    response = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "jet@example.com"
    assert data["profile_complete"] is False
    assert data["access_token"]
    # DB side-effect:
    stmt = select(UserRow).where(UserRow.email == "jet@example.com")  # ty: ignore[invalid-argument-type]
    result = await session.execute(stmt)
    assert result.scalar_one() is not None


async def test_google_sign_in_is_idempotent_for_existing_email(client: AsyncClient) -> None:
    r1 = await client.post("/api/v1/auth/google", json={"id_token": "same@example.com"})
    r2 = await client.post("/api/v1/auth/google", json={"id_token": "same@example.com"})
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["user"]["id"] == r2.json()["user"]["id"]


async def test_google_sign_in_rejects_empty_token(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/google", json={"id_token": ""})
    assert response.status_code == 401


async def test_google_sign_in_rejects_bad_token_shape(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/google", json={"id_token": "not-an-email"})
    assert response.status_code == 401


async def test_logout_returns_204_with_valid_bearer(client: AsyncClient) -> None:
    sign_in = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    token = sign_in.json()["access_token"]
    response = await client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204


async def test_logout_401_without_bearer(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/logout")
    assert response.status_code == 401


async def test_sign_in_case_variations_are_same_user(client: AsyncClient) -> None:
    """Email case must not split into two accounts — classic hijack vector."""
    r1 = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    r2 = await client.post("/api/v1/auth/google", json={"id_token": "Jet@Example.COM"})
    assert r1.status_code == r2.status_code == 200
    assert r1.json()["user"]["id"] == r2.json()["user"]["id"]


async def test_two_sign_ins_yield_two_valid_tokens(client: AsyncClient) -> None:
    """No revocation in Phase 5 — both tokens remain valid until exp."""
    r1 = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    r2 = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    t1, t2 = r1.json()["access_token"], r2.json()["access_token"]
    for t in (t1, t2):
        r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {t}"})
        assert r.status_code == 200


async def test_logout_is_idempotent(client: AsyncClient) -> None:
    """Pin current behavior: double-logout with same token is 204/204."""
    r = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    token = r.json()["access_token"]
    r1 = await client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    r2 = await client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert r1.status_code == 204
    assert r2.status_code == 204


async def test_auth_response_expires_in_matches_token_exp(client: AsyncClient) -> None:
    from backend.auth.jwt import decode_token

    r = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    body = r.json()
    claims = decode_token(body["access_token"])
    assert claims["exp"] - claims["iat"] == body["expires_in"]


@pytest.mark.parametrize(
    "body,expected",
    [
        ({}, 422),
        ({"id_token": None}, 422),
        ({"id_token": "jet@example.com", "extra": "x"}, 422),
    ],
)
async def test_auth_google_rejects_malformed_body(client: AsyncClient, body: dict, expected: int) -> None:
    r = await client.post("/api/v1/auth/google", json=body)
    assert r.status_code == expected
