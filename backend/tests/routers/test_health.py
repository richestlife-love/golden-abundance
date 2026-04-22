import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from backend.server import create_app


def test_health_ok(no_db_client: TestClient) -> None:
    response = no_db_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body.get("status") == "ok"


@pytest.mark.asyncio
async def test_readyz_ok_when_db_healthy(client: AsyncClient) -> None:
    response = await client.get("/readyz")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


@pytest.mark.asyncio
async def test_readyz_returns_503_when_engine_connect_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    """If the engine can't open a connection, /readyz surfaces 503."""
    from backend.routers import health as health_mod

    class _BrokenEngine:
        def connect(self) -> _BrokenCtx:
            return _BrokenCtx()

    class _BrokenCtx:
        async def __aenter__(self) -> None:
            raise RuntimeError("simulated DB outage")

        async def __aexit__(self, *_: object) -> bool:
            return False

    monkeypatch.setattr(health_mod, "get_engine", _BrokenEngine)

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        response = await c.get("/readyz")
    assert response.status_code == 503
    assert response.json() == {"detail": "database unavailable"}
