"""Rate limit enforcement (H1) — dedicated module with the limiter enabled.

The rest of the suite disables rate limiting via ``RATE_LIMIT_DISABLED=1``
so idempotent-loop tests don't flap. Here we opt back in and assert the
429 behaviour end-to-end.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.db.session import get_session
from backend.rate_limit import limiter
from backend.server import create_app
from tests.helpers import sign_in


@pytest.fixture(autouse=True)
def _enable_limiter(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Turn the limiter back on for this module and clear its storage.

    The storage is process-global in-memory; resetting it between tests
    prevents earlier-test request counts from tripping the limit on
    the next test's first call.
    """
    monkeypatch.setenv("RATE_LIMIT_DISABLED", "0")
    get_settings.cache_clear()
    limiter.reset()
    limiter.enabled = True
    yield
    limiter.reset()
    limiter.enabled = False


@pytest_asyncio.fixture
async def rate_limited_client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    """Variant of the ``client`` fixture that rebuilds the app AFTER the
    autouse fixture above has re-enabled the limiter.
    """
    app = create_app()

    async def _override_get_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = _override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_leaderboard_returns_429_past_limit(
    rate_limited_client: AsyncClient,
) -> None:
    """GET /leaderboard/users is capped at 60/minute."""
    headers = await sign_in(rate_limited_client, "jet@example.com")
    # Burn through the whole minute's budget.
    for _ in range(60):
        response = await rate_limited_client.get("/api/v1/leaderboard/users", headers=headers)
        assert response.status_code == 200, response.text
    # The 61st call in the window must 429.
    response = await rate_limited_client.get("/api/v1/leaderboard/users", headers=headers)
    assert response.status_code == 429
    assert response.json() == {"detail": "rate limit exceeded"}


@pytest.mark.asyncio
async def test_team_search_returns_429_past_limit(
    rate_limited_client: AsyncClient,
) -> None:
    """GET /teams is capped at 30/minute."""
    headers = await sign_in(rate_limited_client, "jet@example.com")
    for _ in range(30):
        response = await rate_limited_client.get("/api/v1/teams", headers=headers)
        assert response.status_code == 200, response.text
    response = await rate_limited_client.get("/api/v1/teams", headers=headers)
    assert response.status_code == 429


@pytest.mark.asyncio
async def test_profile_post_returns_429_past_limit(
    rate_limited_client: AsyncClient,
) -> None:
    """POST /me/profile is capped at 10/minute."""
    profile_body = {
        "zh_name": "簡傑特",
        "phone": "912345678",
        "phone_code": "+886",
        "country": "台灣",
        "location": "台北",
    }
    headers = await sign_in(rate_limited_client, "jet@example.com")
    # Will 409 after the first (already-complete) but still counts toward limit.
    for _ in range(10):
        response = await rate_limited_client.post(
            "/api/v1/me/profile",
            json=profile_body,
            headers=headers,
        )
        assert response.status_code in (200, 409), response.text
    response = await rate_limited_client.post(
        "/api/v1/me/profile",
        json=profile_body,
        headers=headers,
    )
    assert response.status_code == 429
