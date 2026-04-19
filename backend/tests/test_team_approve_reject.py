from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import TaskDefRow
from tests.helpers import sign_in_and_complete


async def test_approve_adds_member(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    req = (
        await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
        )
    ).json()

    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/approve",
        headers=jet.headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert any(m["id"] == req["user"]["id"] for m in data["members"])


async def test_team_can_grow_past_cap(client: AsyncClient) -> None:
    """Spec §2.4: teams can grow past cap. Pin current behavior so a future
    cap-enforcement change is a conscious, tested decision."""
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    # Leader + 6 approved members = 7 > cap (default 6).
    for i in range(6):
        out = await sign_in_and_complete(client, f"m{i}@example.com", f"M{i}")
        req = (await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
        )).json()
        r = await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/approve",
            headers=jet.headers,
        )
        assert r.status_code == 200, f"approve #{i} failed: {r.text}"

    detail = (await client.get(
        f"/api/v1/teams/{jet.led_team_id}", headers=jet.headers
    )).json()
    # 6 members in `members` (leader excluded from the members list).
    assert len(detail["members"]) == 6


async def test_approve_non_leader_403(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    req = (
        await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
        )
    ).json()
    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/approve",
        headers=out.headers,
    )
    assert response.status_code == 403


async def test_reject_204(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    req = (
        await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
        )
    ).json()
    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/reject",
        headers=jet.headers,
    )
    assert response.status_code == 204


async def test_approve_grants_challenge_reward_at_cap(
    client: AsyncClient, session: AsyncSession
) -> None:
    """Positive branch of maybe_grant_challenge_rewards.

    Seeds a bonused challenge TaskDef with cap=2 (no seeded_task_defs
    fixture — we don't want unbonused T3 in the query). After the leader
    approves one outsider, the team reaches cap and both members should
    have a RewardRow. Without this test, the entire "reward the team"
    branch in services/team.py is dead code in Phase 5 (T3.bonus is
    None in the default seed).
    """
    session.add(
        TaskDefRow(  # ty: ignore[missing-argument]
            display_id="TX",
            title="小隊挑戰",
            summary="trivial challenge",
            description="",
            tag="陪伴",
            color="#abcdef",
            points=100,
            bonus="挑戰紀念章",
            est_minutes=0,
            is_challenge=True,
            cap=2,
            form_type=None,
        )
    )
    await session.commit()

    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    req = (
        await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
        )
    ).json()
    approve = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/approve",
        headers=jet.headers,
    )
    assert approve.status_code == 200

    # Query rewards directly via the DB — GET /me/rewards lands in Phase 5d.
    from sqlalchemy import select
    from backend.db.models import RewardRow

    jet_rewards = (
        await session.execute(select(RewardRow).where(RewardRow.user_id == jet.user_id))  # ty: ignore[invalid-argument-type]
    ).scalars().all()
    out_rewards = (
        await session.execute(select(RewardRow).where(RewardRow.user_id == out.user_id))  # ty: ignore[invalid-argument-type]
    ).scalars().all()
    assert any(r.bonus == "挑戰紀念章" for r in jet_rewards), jet_rewards
    assert any(r.bonus == "挑戰紀念章" for r in out_rewards), out_rewards


async def test_leader_cannot_approve_request_from_different_team(
    client: AsyncClient,
) -> None:
    """Confused-deputy guard: leader A must not approve a request targeting team B
    by routing it through A's team path.

    This catches the case where `approve_join_request` forgets to verify
    `req.team_id == team_id` and becomes a cross-team privilege escalation.
    """
    leader_a = await sign_in_and_complete(client, "a@example.com", "A")
    leader_b = await sign_in_and_complete(client, "b@example.com", "B")
    out = await sign_in_and_complete(client, "out@example.com", "O")

    req = (
        await client.post(
            f"/api/v1/teams/{leader_b.led_team_id}/join-requests",
            headers=out.headers,
        )
    ).json()

    response = await client.post(
        f"/api/v1/teams/{leader_a.led_team_id}/join-requests/{req['id']}/approve",
        headers=leader_a.headers,
    )
    assert response.status_code == 404


async def test_approve_unknown_team_404(client: AsyncClient) -> None:
    from uuid import uuid4
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    unknown_team = uuid4()
    unknown_req = uuid4()
    r = await client.post(
        f"/api/v1/teams/{unknown_team}/join-requests/{unknown_req}/approve",
        headers=jet.headers,
    )
    assert r.status_code == 404


async def test_approve_unknown_req_404(client: AsyncClient) -> None:
    from uuid import uuid4
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{uuid4()}/approve",
        headers=jet.headers,
    )
    assert r.status_code == 404


async def test_reject_unknown_req_404(client: AsyncClient) -> None:
    from uuid import uuid4
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{uuid4()}/reject",
        headers=jet.headers,
    )
    assert r.status_code == 404


async def test_cancel_unknown_req_404(client: AsyncClient) -> None:
    """DELETE /join-requests/{unknown} → 404."""
    from uuid import uuid4
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.delete(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{uuid4()}",
        headers=jet.headers,
    )
    assert r.status_code == 404
