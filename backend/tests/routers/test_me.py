import time

import jwt as pyjwt
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.helpers import sign_in


async def test_get_me_returns_current_user(client: AsyncClient) -> None:
    headers = await sign_in(client, "jet@example.com")

    response = await client.get("/api/v1/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "jet@example.com"
    assert data["profile_complete"] is False
    assert data["name"] == "jet"  # email-local-part fallback


async def test_get_me_401_without_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/me")
    assert response.status_code == 401


async def test_401_when_user_was_deleted(
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    """Valid JWT whose `sub` points at a deleted user → on next request,
    current_user upserts a fresh row with the same sub. Verified by
    display_id + id continuity, not by 401 (post-6a behaviour differs
    from the HS256 stub: upsert-on-miss materializes the row again)."""
    from sqlalchemy import delete

    from backend.db.models import UserRow

    headers = await sign_in(client, "jet@example.com")
    first = await client.get("/api/v1/me", headers=headers)
    assert first.status_code == 200
    first_id = first.json()["id"]

    stmt = delete(UserRow).where(UserRow.email == "jet@example.com")
    await session.execute(stmt)
    await session.commit()

    # Same bearer token — current_user sees the sub, doesn't find a row,
    # and re-upserts deterministically on that sub.
    r = await client.get("/api/v1/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["id"] == first_id


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


async def test_me_rejects_expired_bearer(
    client: AsyncClient,
    mint_access_token,
) -> None:
    expired = mint_access_token(exp=int(time.time()) - 3600)
    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {expired}"})
    assert r.status_code == 401


async def test_401_sets_www_authenticate_bearer(client: AsyncClient) -> None:
    r = await client.get("/api/v1/me")
    assert r.status_code == 401
    assert r.headers.get("WWW-Authenticate") == "Bearer"


async def test_me_rejects_jwt_signed_with_wrong_key(client: AsyncClient) -> None:
    """Router-level pin: a syntactically valid HS256 JWT → 401.

    The verifier only accepts RS256 signed by the JWKS key; HS256 with
    any secret fails signature verification before it even reaches the
    claim check.
    """
    forged = pyjwt.encode(
        {
            "sub": "00000000-0000-0000-0000-000000000000",
            "email": "x@e.com",
            "aud": "authenticated",
            "iss": "https://test-ref.supabase.co/auth/v1",
            "exp": 9_999_999_999,
            "iat": 0,
        },
        "attacker-secret-32-bytes-long-padding",
        algorithm="HS256",
    )
    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


async def test_me_rejects_alg_none_jwt(client: AsyncClient) -> None:
    """Router-level pin: a `none`-alg token must not be trusted."""
    none_alg = pyjwt.encode(
        {
            "sub": "00000000-0000-0000-0000-000000000000",
            "email": "x@e.com",
            "aud": "authenticated",
            "iss": "https://test-ref.supabase.co/auth/v1",
            "exp": 9_999_999_999,
            "iat": 0,
        },
        key="",
        algorithm="none",
    )
    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {none_alg}"})
    assert r.status_code == 401


async def test_me_rejects_jwt_without_sub_claim(
    client: AsyncClient,
    rsa_test_keypair: tuple[str, str],
) -> None:
    """Router-level pin: a RS256-signed token missing `sub` → 401."""
    private_pem, _ = rsa_test_keypair
    forged = pyjwt.encode(
        {
            "email": "x@e.com",
            "aud": "authenticated",
            "iss": "https://test-ref.supabase.co/auth/v1",
            "exp": 9_999_999_999,
            "iat": 0,
        },
        private_pem,
        algorithm="RS256",
        headers={"kid": "test-kid-2026"},
    )
    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


async def test_me_rejects_very_long_garbage_token(client: AsyncClient) -> None:
    """No crash / DoS on pathologically long input — clean 401."""
    r = await client.get("/api/v1/me", headers={"Authorization": "Bearer " + "a" * 10_000})
    assert r.status_code == 401
