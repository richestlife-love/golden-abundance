from uuid import uuid4

from httpx import AsyncClient

from tests.helpers import sign_in_and_complete


async def test_create_join_request_201(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")

    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["team_id"] == str(jet.led_team_id)


async def test_create_join_request_leader_to_own_team_409(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=jet.headers
    )
    assert response.status_code == 409


async def test_create_join_request_existing_member_to_same_team_409(
    client: AsyncClient,
) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    req = (
        await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
        )
    ).json()
    await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/approve",
        headers=jet.headers,
    )
    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )
    assert response.status_code == 409


async def test_create_join_request_duplicate_pending_409(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    await client.post(f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers)
    second = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )
    assert second.status_code == 409


async def test_create_join_request_404_for_unknown_team(client: AsyncClient) -> None:
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    response = await client.post(
        f"/api/v1/teams/{uuid4()}/join-requests",
        headers=out.headers,
    )
    assert response.status_code == 404


async def test_cancel_unknown_req_404(client: AsyncClient) -> None:
    """DELETE /join-requests/{unknown} → 404."""
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.delete(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{uuid4()}",
        headers=jet.headers,
    )
    assert r.status_code == 404


async def test_cancel_join_request_by_requester(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    created = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )
    req_id = created.json()["id"]

    response = await client.delete(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req_id}", headers=out.headers
    )
    assert response.status_code == 204


async def test_cancel_join_request_403_for_non_requester(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    third = await sign_in_and_complete(client, "third@example.com", "第三人")
    created = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )
    req_id = created.json()["id"]

    response = await client.delete(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req_id}", headers=third.headers
    )
    assert response.status_code == 403


async def test_create_join_request_rejects_if_pending_elsewhere(
    client: AsyncClient,
) -> None:
    """The at-most-one-outstanding-request-per-user invariant spans all teams."""
    leader_a = await sign_in_and_complete(client, "a@example.com", "A")
    leader_b = await sign_in_and_complete(client, "b@example.com", "B")
    out = await sign_in_and_complete(client, "out@example.com", "O")

    r1 = await client.post(
        f"/api/v1/teams/{leader_a.led_team_id}/join-requests",
        headers=out.headers,
    )
    assert r1.status_code == 201

    r2 = await client.post(
        f"/api/v1/teams/{leader_b.led_team_id}/join-requests",
        headers=out.headers,
    )
    assert r2.status_code == 409


async def test_requester_can_reapply_after_rejection(client: AsyncClient) -> None:
    """Rejected requests don't lock out re-applications (status != 'pending' path)."""
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")

    r1 = (await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )).json()
    await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{r1['id']}/reject",
        headers=jet.headers,
    )
    r2 = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )
    assert r2.status_code == 201


async def test_requester_can_rejoin_after_leave(client: AsyncClient) -> None:
    """After leaving a team, a user may re-request to join it."""
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")

    r = (await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )).json()
    await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{r['id']}/approve",
        headers=jet.headers,
    )
    await client.post(
        f"/api/v1/teams/{jet.led_team_id}/leave", headers=out.headers
    )
    r2 = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )
    assert r2.status_code == 201
