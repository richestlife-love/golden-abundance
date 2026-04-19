from fastapi.testclient import TestClient


def test_health_ok(no_db_client: TestClient) -> None:
    response = no_db_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body.get("status") == "ok"
