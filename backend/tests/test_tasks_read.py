from httpx import AsyncClient

from tests.helpers import sign_in_and_complete


async def test_get_task_by_id(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t1_id = seeded_task_defs["T1"].id

    response = await client.get(f"/api/v1/tasks/{t1_id}", headers=h)
    assert response.status_code == 200
    data = response.json()
    assert data["display_id"] == "T1"
    assert "steps" in data
    assert isinstance(data["steps"], list)
    for step in data["steps"]:
        assert "label" in step
        assert "done" in step


async def test_get_task_404(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get(
        "/api/v1/tasks/00000000-0000-0000-0000-000000000000", headers=h
    )
    assert response.status_code == 404


async def test_list_me_tasks_returns_all_four(
    client: AsyncClient, seeded_task_defs
) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/me/tasks", headers=h)
    assert response.status_code == 200
    data = response.json()
    assert {t["display_id"] for t in data} == {"T1", "T2", "T3", "T4"}


async def test_t2_locked_until_t1_completed_visible_in_list(
    client: AsyncClient, seeded_task_defs
) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/me/tasks", headers=h)
    by_did = {t["display_id"]: t for t in response.json()}
    assert by_did["T2"]["status"] == "locked"
    assert by_did["T4"]["status"] == "expired"
