import pytest
from uuid import uuid4

from httpx import AsyncClient


@pytest.mark.parametrize(
    "method,path",
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
