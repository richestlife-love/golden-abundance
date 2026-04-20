"""Unit tests for reward.maybe_grant_challenge_rewards.

The POSITIVE branch (cap reached → reward created) is covered
end-to-end in tests/routers/test_teams_approve_reject.py::
test_approve_grants_challenge_reward_at_cap. These tests cover the two
no-op branches that integration tests don't exercise in the default seed.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import RewardRow, TaskDefRow
from backend.services.reward import maybe_grant_challenge_rewards
from backend.services.user import upsert_user_by_email


async def test_maybe_grant_noop_when_no_bonused_challenges(session: AsyncSession) -> None:
    """Empty challenge catalog must short-circuit before the team-total
    query — no rewards created, no exception.
    """
    user = await upsert_user_by_email(session, email="nochal@example.com")
    await session.flush()

    await maybe_grant_challenge_rewards(session, user=user)

    rewards = (await session.execute(select(RewardRow))).scalars().all()
    assert rewards == []


async def test_maybe_grant_skips_challenge_when_team_under_cap(session: AsyncSession) -> None:
    """A bonused challenge whose cap the user's team does not meet must
    not issue a reward. The user here has no team at all — total=0 < cap.
    """
    session.add(
        TaskDefRow(
            display_id="TUND",
            title="unreachable challenge",
            summary="s",
            description="d",
            tag="探索",
            color="#000000",
            points=1,
            bonus="never-earned",
            est_minutes=0,
            is_challenge=True,
            cap=99,
            form_type=None,
        ),
    )
    user = await upsert_user_by_email(session, email="lone@example.com")
    await session.flush()

    await maybe_grant_challenge_rewards(session, user=user)

    rewards = (await session.execute(select(RewardRow).where(RewardRow.user_id == user.id))).scalars().all()
    assert rewards == []
