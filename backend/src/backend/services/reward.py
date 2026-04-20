"""Reward service: list + creation on task completion."""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import Reward as ContractReward
from backend.db.models import RewardRow, TaskDefRow, UserRow
from backend.services.team import caller_team_totals


async def create_reward_if_bonus(session: AsyncSession, *, user: UserRow, task_def: TaskDefRow) -> RewardRow | None:
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


async def maybe_grant_challenge_rewards(session: AsyncSession, *, user: UserRow) -> None:
    """Create RewardRows for any bonused challenge TaskDef where the user
    now meets cap. Idempotent. No-op when the user has no team
    (total == 0) or no bonused challenges exist.

    Concurrency: uses Postgres ``ON CONFLICT DO NOTHING`` against the
    ``uq_reward_user_task`` constraint so two simultaneous
    approve-join-request calls that both cross the cap produce exactly
    one reward without rolling back either caller's transaction.
    """
    challenge_defs = (
        (
            await session.execute(
                select(TaskDefRow)
                .where(TaskDefRow.is_challenge.is_(True))  # ty: ignore[unresolved-attribute]
                .where(TaskDefRow.bonus.is_not(None))  # ty: ignore[unresolved-attribute]
            )
        )
        .scalars()
        .all()
    )
    if not challenge_defs:
        return

    led_total, joined_total = await caller_team_totals(session, user)
    total = max(led_total, joined_total)

    for td in challenge_defs:
        assert td.cap is not None  # enforced by row_to_contract_task; re-verify here
        if total < td.cap:
            continue
        assert td.bonus is not None  # filtered by the query above
        stmt = (
            pg_insert(RewardRow)
            .values(
                user_id=user.id,
                task_def_id=td.id,
                task_title=td.title,
                bonus=td.bonus,
                status="earned",
            )
            .on_conflict_do_nothing(constraint="uq_reward_user_task")
        )
        await session.execute(stmt)
    await session.flush()


async def list_rewards_for(session: AsyncSession, user: UserRow) -> list[ContractReward]:
    rows = (
        (
            await session.execute(
                select(RewardRow)
                .where(RewardRow.user_id == user.id)  # ty: ignore[invalid-argument-type]
                .order_by(RewardRow.earned_at.desc())  # ty: ignore[unresolved-attribute]
            )
        )
        .scalars()
        .all()
    )
    return [row_to_contract_reward(r) for r in rows]
