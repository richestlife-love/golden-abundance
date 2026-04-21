"""401 handling + upsert-on-first-auth coverage for current_user."""

from collections.abc import Callable
from typing import Any
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError
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


async def test_current_user_recovers_from_concurrent_upsert_race(
    client: AsyncClient,
    mint_access_token: Callable[..., str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Simulate a concurrent first-sign-in: two requests for the same `sub`
    both see `session.get(...) is None`; the other request commits its row
    between our get and our upsert's flush, so our upsert hits the PK
    unique constraint. current_user should catch IntegrityError, roll
    back, re-fetch, and return the winning row — not 500.
    """
    from backend.auth import dependencies as deps
    from backend.db.engine import get_session_maker
    from backend.db.models import UserRow

    auth_id = UUID(int=7777)

    async def racing_upsert(_session: Any, *, auth_user_id: UUID, email: str) -> Any:
        # Simulate another request winning the race: write the row via a
        # separate, independently-committed session so our fixture session
        # will see it after rollback.
        async with get_session_maker()() as other:
            other.add(
                UserRow(
                    id=auth_user_id,
                    display_id="URACER",
                    email=email,
                    profile_complete=False,
                )
            )
            await other.commit()
        raise IntegrityError("duplicate pk", {}, Exception())

    monkeypatch.setattr(deps, "upsert_user_by_supabase_identity", racing_upsert)

    token = mint_access_token(user_id=auth_id, email="racer@example.com")
    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == str(auth_id)
    assert body["email"] == "racer@example.com"


async def test_current_user_reraises_when_retry_still_finds_no_row(
    session: AsyncSession,
    mint_access_token: Callable[..., str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If upsert fails with IntegrityError but the row genuinely doesn't
    exist after rollback (e.g., a unique-constraint on something other
    than the PK — the stale-email case from 6a's Known Deferrals),
    current_user must not silently swallow the error.
    """
    from backend.auth import dependencies as deps

    async def always_fail(_session: Any, *, auth_user_id: UUID, email: str) -> Any:
        raise IntegrityError("duplicate email", {}, Exception())

    monkeypatch.setattr(deps, "upsert_user_by_supabase_identity", always_fail)

    token = mint_access_token(user_id=UUID(int=7778), email="ghost@example.com")

    with pytest.raises(IntegrityError):
        await deps.current_user(
            authorization=f"Bearer {token}",
            session=session,
        )
