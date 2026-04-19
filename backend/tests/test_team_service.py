from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import TeamMembershipRow
from backend.services.team import (
    create_led_team,
    row_to_contract_team,
    search_team_refs,
    user_to_ref,
)
from backend.services.user import upsert_user_by_email


async def test_create_led_team_sets_name_and_topic(session: AsyncSession) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    user.zh_name = "簡傑特"
    await session.flush()

    team = await create_led_team(session, user)
    await session.commit()

    assert team.display_id.startswith("T-")
    assert "簡傑特" in team.name
    assert team.topic == "尚未指定主題"
    assert team.leader_id == user.id


async def test_row_to_contract_team_as_leader_sees_requests(session: AsyncSession) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    team = await create_led_team(session, user)
    await session.commit()

    contract = await row_to_contract_team(session, team, caller_id=user.id)
    assert contract.role == "leader"
    assert contract.requests == []  # leader sees empty list, not None


async def test_row_to_contract_team_as_outsider_hides_requests(session: AsyncSession) -> None:
    leader = await upsert_user_by_email(session, email="leader@example.com")
    outsider = await upsert_user_by_email(session, email="out@example.com")
    await session.flush()
    team = await create_led_team(session, leader)
    await session.commit()

    contract = await row_to_contract_team(session, team, caller_id=outsider.id)
    assert contract.role is None
    assert contract.requests is None


async def test_row_to_contract_team_as_member(session: AsyncSession) -> None:
    leader = await upsert_user_by_email(session, email="leader@example.com")
    member = await upsert_user_by_email(session, email="mem@example.com")
    await session.flush()
    team = await create_led_team(session, leader)
    session.add(TeamMembershipRow(team_id=team.id, user_id=member.id))  # ty: ignore[missing-argument]
    await session.commit()

    contract = await row_to_contract_team(session, team, caller_id=member.id)
    assert contract.role == "member"
    assert contract.requests is None
    assert any(m.id == member.id for m in contract.members)


async def test_search_team_refs_filters_by_leader_display_id(session: AsyncSession) -> None:
    jet = await upsert_user_by_email(session, email="jet@example.com")
    jet.zh_name = "簡傑特"
    wei = await upsert_user_by_email(session, email="wei@example.com")
    wei.zh_name = "偉"
    await session.flush()
    await create_led_team(session, jet)
    await create_led_team(session, wei)
    await session.commit()

    page = await search_team_refs(
        session, q=None, topic=None, leader_display_id=jet.display_id, cursor=None, limit=20
    )
    assert len(page.items) == 1
    assert page.items[0].leader.id == jet.id


async def test_search_team_refs_filters_by_q_on_name(session: AsyncSession) -> None:
    """q does an ILIKE match against name OR alias."""
    jet = await upsert_user_by_email(session, email="jet@example.com")
    jet.zh_name = "簡傑特"
    wei = await upsert_user_by_email(session, email="wei@example.com")
    wei.zh_name = "偉"
    await session.flush()
    jet_team = await create_led_team(session, jet)
    jet_team.alias = "金富有小隊"
    wei_team = await create_led_team(session, wei)
    wei_team.alias = "完全無關"
    await session.commit()

    by_name = await search_team_refs(
        session, q="簡傑特", topic=None, leader_display_id=None, cursor=None, limit=20
    )
    assert [t.id for t in by_name.items] == [jet_team.id]

    by_alias = await search_team_refs(
        session, q="金富有", topic=None, leader_display_id=None, cursor=None, limit=20
    )
    assert [t.id for t in by_alias.items] == [jet_team.id]


async def test_search_team_refs_filters_by_topic(session: AsyncSession) -> None:
    """topic is an exact-match filter (not ILIKE)."""
    jet = await upsert_user_by_email(session, email="jet@example.com")
    wei = await upsert_user_by_email(session, email="wei@example.com")
    await session.flush()
    jet_team = await create_led_team(session, jet)
    jet_team.topic = "長者陪伴"
    wei_team = await create_led_team(session, wei)
    wei_team.topic = "社區服務"
    await session.commit()

    page = await search_team_refs(
        session, q=None, topic="長者陪伴", leader_display_id=None, cursor=None, limit=20
    )
    assert [t.id for t in page.items] == [jet_team.id]


async def test_user_to_ref_does_not_leak_pii(session: AsyncSession) -> None:
    """UserRef must not expose email/phone/line_id/etc. to other team members."""
    user = await upsert_user_by_email(session, email="jet@example.com")
    user.phone = "0912345678"
    user.line_id = "private-line-id"
    user.zh_name = "簡傑特"
    await session.flush()

    ref = user_to_ref(user)
    dumped = ref.model_dump()
    assert set(dumped.keys()) == {"id", "display_id", "name", "avatar_url"}
    assert "email" not in dumped
    assert "phone" not in dumped
    assert "line_id" not in dumped
