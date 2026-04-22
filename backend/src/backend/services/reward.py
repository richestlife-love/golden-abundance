"""Reward service: list + creation on task completion."""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import Reward as ContractReward
from backend.db.models import RewardRow, TaskDefRow, UserRow
from backend.services.team import caller_team_totals


async def create_reward_if_bonus(session: AsyncSession, *, user: UserRow, task_def: TaskDefRow) -> RewardRow | None:
    if task_def.bonus is None:
        return None
    row = RewardRow(
        user_id=user.id,
        task_def_id=task_def.id,
        task_title=task_def.title,
        bonus=task_def.bonus,
        status="earned",
    )
    session.add(row)
    await session.flush()
    return row


def row_to_contract_reward(row: RewardRow) -> ContractReward:
    return ContractReward(
        id=row.id,
        user_id=row.user_id,
        task_id=row.task_def_id,
        task_title=row.task_title,
        bonus=row.bonus,
        status=row.status,
        earned_at=row.earned_at,
        claimed_at=row.claimed_at,
    )


async def load_bonused_challenge_defs(session: AsyncSession) -> Sequence[TaskDefRow]:
    """Fetch every bonused challenge TaskDef in one query.

    Exposed so callers that grant rewards for many users in a loop
    (e.g., ``approve_join_request``) can reuse the same def list
    across iterations instead of re-querying per user (M3).
    """
    return (
        (
            await session.execute(
                select(TaskDefRow).where(TaskDefRow.is_challenge.is_(True)).where(TaskDefRow.bonus.is_not(None)),
            )
        )
        .scalars()
        .all()
    )


async def grant_rewards_for_user(
    session: AsyncSession,
    *,
    user: UserRow,
    challenge_defs: Sequence[TaskDefRow],
) -> None:
    """Low-level: inspect ``user``'s team totals against pre-loaded
    ``challenge_defs`` and upsert a ``RewardRow`` for each qualifying
    challenge.

    ``ON CONFLICT DO NOTHING`` against ``uq_reward_user_task`` keeps
    this idempotent under concurrent callers (see the race discussed
    at ``db/models.py``'s constraints).
    """
    if not challenge_defs:
        return

    led_total, joined_total = await caller_team_totals(session, user)
    total = max(led_total, joined_total)

    for td in challenge_defs:
        cap, bonus = td.cap, td.bonus
        # bonus is non-None by the load filter; cap is non-None for any
        # bonused challenge by convention. Re-checked so the function is
        # safe if those invariants ever slip.
        if cap is None or bonus is None or total < cap:
            continue
        stmt = (
            pg_insert(RewardRow)
            .values(
                user_id=user.id,
                task_def_id=td.id,
                task_title=td.title,
                bonus=bonus,
                status="earned",
            )
            .on_conflict_do_nothing(constraint="uq_reward_user_task")
        )
        await session.execute(stmt)
    await session.flush()


async def maybe_grant_challenge_rewards(session: AsyncSession, *, user: UserRow) -> None:
    """Create RewardRows for any bonused challenge TaskDef where the user
    now meets cap. Idempotent. No-op when the user has no team
    (total == 0) or no bonused challenges exist.

    Thin wrapper: loads the bonused challenge set once, then delegates
    to ``grant_rewards_for_user``. Call this when granting for a single
    user; call the pair of helpers directly when iterating over many
    users in the same transaction (M3 — avoids re-querying defs).
    """
    challenge_defs = await load_bonused_challenge_defs(session)
    await grant_rewards_for_user(session, user=user, challenge_defs=challenge_defs)


async def list_rewards_for(session: AsyncSession, user: UserRow) -> list[ContractReward]:
    rows = (
        (
            await session.execute(
                select(RewardRow).where(RewardRow.user_id == user.id).order_by(RewardRow.earned_at.desc()),
            )
        )
        .scalars()
        .all()
    )
    return [row_to_contract_reward(r) for r in rows]
