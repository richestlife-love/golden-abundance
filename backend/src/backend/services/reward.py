"""Reward service: list + creation on task completion."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import Reward as ContractReward
from backend.db.models import RewardRow, TaskDefRow, UserRow


async def create_reward_if_bonus(
    session: AsyncSession, *, user: UserRow, task_def: TaskDefRow
) -> RewardRow | None:
    if task_def.bonus is None:
        return None
    row = RewardRow(  # ty: ignore[missing-argument]
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
        status=row.status,  # type: ignore[arg-type]
        earned_at=row.earned_at,
        claimed_at=row.claimed_at,
    )


async def list_rewards_for(
    session: AsyncSession, user: UserRow
) -> list[ContractReward]:
    rows = (
        await session.execute(
            select(RewardRow)
            .where(RewardRow.user_id == user.id)  # ty: ignore[invalid-argument-type]
            .order_by(RewardRow.earned_at.desc())  # ty: ignore[unresolved-attribute]
        )
    ).scalars().all()
    return [row_to_contract_reward(r) for r in rows]
