from httpx import AsyncClient

from tests.helpers import INTEREST_SUBMIT_BODY, TICKET_SUBMIT_BODY, sign_in_and_complete


async def test_rewards_empty_for_new_user(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/me/rewards", headers=h)
    assert response.status_code == 200
    assert response.json() == []


async def test_reward_appears_after_bonus_task(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t1 = seeded_task_defs["T1"].id
    t2 = seeded_task_defs["T2"].id
    await client.post(f"/api/v1/tasks/{t1}/submit", json=INTEREST_SUBMIT_BODY, headers=h)
    await client.post(f"/api/v1/tasks/{t2}/submit", json=TICKET_SUBMIT_BODY, headers=h)

    response = await client.get("/api/v1/me/rewards", headers=h)
    assert response.status_code == 200
    rewards = response.json()
    assert len(rewards) == 1
    assert rewards[0]["bonus"] == "限定紀念徽章"


async def test_me_rewards_is_scoped_to_caller(client: AsyncClient, seeded_task_defs) -> None:
    """A missing `WHERE user_id = :caller` would leak rewards across users."""
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")

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

    jet_rewards = (await client.get("/api/v1/me/rewards", headers=jet.headers)).json()
    out_rewards = (await client.get("/api/v1/me/rewards", headers=out.headers)).json()

    assert len(jet_rewards) == 1
    assert len(out_rewards) == 0
