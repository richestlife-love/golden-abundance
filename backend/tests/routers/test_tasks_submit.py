from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.helpers import INTEREST_SUBMIT_BODY, TICKET_SUBMIT_BODY, sign_in, sign_in_and_complete


async def test_submit_interest_marks_completed(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t1 = seeded_task_defs["T1"].id

    response = await client.post(f"/api/v1/tasks/{t1}/submit", json=INTEREST_SUBMIT_BODY, headers=h)
    assert response.status_code == 200
    data = response.json()
    assert data["task"]["status"] == "completed"
    assert data["task"]["progress"] == 1.0
    assert data["reward"] is None


async def test_submit_ticket_creates_reward(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t1 = seeded_task_defs["T1"].id
    t2 = seeded_task_defs["T2"].id

    await client.post(f"/api/v1/tasks/{t1}/submit", json=INTEREST_SUBMIT_BODY, headers=h)
    response = await client.post(f"/api/v1/tasks/{t2}/submit", json=TICKET_SUBMIT_BODY, headers=h)
    assert response.status_code == 200
    assert response.json()["reward"] is not None
    assert response.json()["reward"]["bonus"] == "限定紀念徽章"
    assert response.json()["reward"]["status"] == "earned"


async def test_submit_wrong_form_type_400(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t1 = seeded_task_defs["T1"].id
    response = await client.post(f"/api/v1/tasks/{t1}/submit", json=TICKET_SUBMIT_BODY, headers=h)
    assert response.status_code == 400


async def test_submit_locked_task_412(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t2 = seeded_task_defs["T2"].id
    response = await client.post(f"/api/v1/tasks/{t2}/submit", json=TICKET_SUBMIT_BODY, headers=h)
    assert response.status_code == 412


async def test_submit_twice_returns_409(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t1 = seeded_task_defs["T1"].id
    await client.post(f"/api/v1/tasks/{t1}/submit", json=INTEREST_SUBMIT_BODY, headers=h)
    second = await client.post(f"/api/v1/tasks/{t1}/submit", json=INTEREST_SUBMIT_BODY, headers=h)
    assert second.status_code == 409


async def test_submit_to_formless_task_400(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t3 = seeded_task_defs["T3"].id
    response = await client.post(f"/api/v1/tasks/{t3}/submit", json=INTEREST_SUBMIT_BODY, headers=h)
    assert response.status_code == 400
    assert "does not accept submissions" in response.json()["detail"].lower()


async def test_submit_to_nonexistent_task_404(client: AsyncClient, seeded_task_defs) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.post(
        f"/api/v1/tasks/{uuid4()}/submit",
        json=INTEREST_SUBMIT_BODY,
        headers=jet.headers,
    )
    assert r.status_code == 404


async def test_submit_interest_with_empty_list_is_422(client: AsyncClient, seeded_task_defs) -> None:
    """Contract declares `interests: list[str] = Field(min_length=1)`.

    A regression that drops the min_length would silently accept empty
    submissions. Pydantic catches this before reaching the service.
    """
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.post(
        f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit",
        json={"form_type": "interest", "interests": []},
        headers=jet.headers,
    )
    assert r.status_code == 422


async def test_submit_t2_twice_does_not_create_second_reward(
    client: AsyncClient,
    session: AsyncSession,
    seeded_task_defs,
) -> None:
    """Bonus-carrying tasks must not double-issue rewards on resubmit."""
    from sqlalchemy import func, select

    from backend.db.models import RewardRow

    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    await client.post(
        f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit",
        json=INTEREST_SUBMIT_BODY,
        headers=jet.headers,
    )
    await client.post(
        f"/api/v1/tasks/{seeded_task_defs['T2'].id}/submit",
        json=TICKET_SUBMIT_BODY,
        headers=jet.headers,
    )
    r2 = await client.post(
        f"/api/v1/tasks/{seeded_task_defs['T2'].id}/submit",
        json=TICKET_SUBMIT_BODY,
        headers=jet.headers,
    )
    assert r2.status_code == 409

    count = (
        await session.execute(select(func.count()).select_from(RewardRow).where(RewardRow.user_id == jet.user_id))
    ).scalar_one()
    assert count == 1


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", f"/api/v1/tasks/{uuid4()}"),
        ("POST", f"/api/v1/tasks/{uuid4()}/submit"),
        ("GET", "/api/v1/me/tasks"),
        ("GET", "/api/v1/me/rewards"),
        ("GET", "/api/v1/leaderboard/users"),
        ("GET", "/api/v1/leaderboard/teams"),
        ("GET", "/api/v1/news"),
    ],
)
async def test_phase_5d_endpoint_requires_auth(client: AsyncClient, method: str, path: str) -> None:
    r = await client.request(method, path)
    assert r.status_code == 401, f"{method} {path} should require auth"


async def test_profile_incomplete_can_submit_task(client: AsyncClient, seeded_task_defs) -> None:
    """Known gap (FR §05): backend ``current_user`` verifies the JWT and
    upserts a ``UserRow`` on first sight, but does NOT inspect
    ``profile_complete``. Any client holding a valid bearer token can
    call business endpoints regardless of whether they've completed
    their profile. Pinned so closing the gap (e.g., adding a
    ``require_profile_complete`` dep) is a conscious, tested change.
    """
    h = await sign_in(client, "incomplete@example.com")
    r = await client.post(
        f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit",
        json=INTEREST_SUBMIT_BODY,
        headers=h,
    )
    assert r.status_code == 200
    assert r.json()["task"]["status"] == "completed"
