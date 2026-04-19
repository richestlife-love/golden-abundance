"""Task service: merge global TaskDef + per-caller state into the
contract `Task` shape. Enforces the derivation rules from spec §1.3.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import SubmitBody
from backend.contract import Task as ContractTask
from backend.contract import TaskStep as ContractTaskStep
from backend.contract import TaskSubmissionResponse, TeamChallengeProgress
from backend.db.models import (
    TaskDefRequiresRow,
    TaskDefRow,
    TaskProgressRow,
    TaskStepDefRow,
    TaskStepProgressRow,
    TeamMembershipRow,
    TeamRow,
    UserRow,
)
from backend.services.reward import create_reward_if_bonus, row_to_contract_reward


async def _completed_task_def_ids(session: AsyncSession, user_id: UUID) -> set[UUID]:
    rows = (
        await session.execute(
            select(TaskProgressRow.task_def_id)  # ty: ignore[no-matching-overload]
            .where(TaskProgressRow.user_id == user_id)
            .where(TaskProgressRow.status == "completed")
        )
    ).all()
    return {row[0] for row in rows}


async def _required_ids(session: AsyncSession, task_def_id: UUID) -> list[UUID]:
    rows = (
        await session.execute(
            select(TaskDefRequiresRow.requires_id).where(  # ty: ignore[no-matching-overload]
                TaskDefRequiresRow.task_def_id == task_def_id
            )
        )
    ).all()
    return [row[0] for row in rows]


async def _team_totals(
    session: AsyncSession, caller: UserRow, *, cap: int
) -> TeamChallengeProgress:
    led = (
        await session.execute(select(TeamRow).where(TeamRow.leader_id == caller.id))  # ty: ignore[invalid-argument-type]
    ).scalar_one_or_none()
    joined_link = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.user_id == caller.id)  # ty: ignore[invalid-argument-type]
        )
    ).scalar_one_or_none()

    led_total = 0
    if led is not None:
        led_members = (
            await session.execute(
                select(TeamMembershipRow).where(TeamMembershipRow.team_id == led.id)  # ty: ignore[invalid-argument-type]
            )
        ).scalars().all()
        led_total = 1 + len(led_members)

    joined_total = 0
    if joined_link is not None:
        joined_team = await session.get(TeamRow, joined_link.team_id)
        if joined_team is not None:
            mems = (
                await session.execute(
                    select(TeamMembershipRow).where(
                        TeamMembershipRow.team_id == joined_team.id  # ty: ignore[invalid-argument-type]
                    )
                )
            ).scalars().all()
            joined_total = 1 + len(mems)

    return TeamChallengeProgress(
        total=max(led_total, joined_total),
        cap=cap,
        led_total=led_total,
        joined_total=joined_total,
    )


async def _steps_for(
    session: AsyncSession, task_def_id: UUID, user_id: UUID
) -> list[ContractTaskStep]:
    defs = (
        await session.execute(
            select(TaskStepDefRow)
            .where(TaskStepDefRow.task_def_id == task_def_id)  # ty: ignore[invalid-argument-type]
            .order_by(TaskStepDefRow.order.asc())  # ty: ignore[unresolved-attribute]
        )
    ).scalars().all()
    if not defs:
        return []
    step_ids = [d.id for d in defs]
    progress_rows = (
        await session.execute(
            select(TaskStepProgressRow)
            .where(TaskStepProgressRow.user_id == user_id)  # ty: ignore[invalid-argument-type]
            .where(TaskStepProgressRow.step_id.in_(step_ids))  # ty: ignore[unresolved-attribute]
        )
    ).scalars().all()
    done_map = {r.step_id: r.done for r in progress_rows}
    return [
        ContractTaskStep(
            id=d.id, label=d.label, done=done_map.get(d.id, False), order=d.order
        )
        for d in defs
    ]


async def row_to_contract_task(
    session: AsyncSession,
    task_def: TaskDefRow,
    *,
    caller: UserRow,
    completed_ids: set[UUID] | None = None,
) -> ContractTask:
    if completed_ids is None:
        completed_ids = await _completed_task_def_ids(session, caller.id)
    requires = await _required_ids(session, task_def.id)

    progress_row = (
        await session.execute(
            select(TaskProgressRow)
            .where(TaskProgressRow.user_id == caller.id)  # ty: ignore[invalid-argument-type]
            .where(TaskProgressRow.task_def_id == task_def.id)  # ty: ignore[invalid-argument-type]
        )
    ).scalar_one_or_none()

    if task_def.is_challenge:
        if task_def.cap is None:
            raise RuntimeError(
                f"Challenge task {task_def.display_id} is missing cap — "
                "is_challenge=True requires a non-null cap."
            )
        team_progress = await _team_totals(session, caller, cap=task_def.cap)
    else:
        team_progress = None

    locked = any(req not in completed_ids for req in requires)
    now = datetime.now(timezone.utc)

    if locked:
        status = "locked"
    elif (
        task_def.due_at is not None
        and task_def.due_at < now
        and (progress_row is None or progress_row.status != "completed")
    ):
        status = "expired"
    elif task_def.is_challenge:
        assert team_progress is not None
        if team_progress.total >= team_progress.cap:
            status = "completed"
        elif team_progress.total > 0:
            status = "in_progress"
        else:
            status = "todo"
    else:
        status = progress_row.status if progress_row else "todo"

    if task_def.is_challenge:
        assert team_progress is not None
        progress_value: float | None = min(team_progress.total / team_progress.cap, 1.0)
    else:
        progress_value = progress_row.progress if progress_row else None

    steps = await _steps_for(session, task_def.id, caller.id)

    return ContractTask(
        id=task_def.id,
        display_id=task_def.display_id,
        title=task_def.title,
        summary=task_def.summary,
        description=task_def.description,
        tag=task_def.tag,  # type: ignore[arg-type]
        color=task_def.color,
        points=task_def.points,
        bonus=task_def.bonus,
        due_at=task_def.due_at,
        est_minutes=task_def.est_minutes,
        is_challenge=task_def.is_challenge,
        requires=requires,
        cap=task_def.cap,
        form_type=task_def.form_type,  # type: ignore[arg-type]
        status=status,  # type: ignore[arg-type]
        progress=progress_value,
        steps=steps,
        team_progress=team_progress,
        created_at=task_def.created_at,
    )


async def list_caller_tasks(
    session: AsyncSession, *, caller: UserRow
) -> list[ContractTask]:
    defs = (
        await session.execute(
            select(TaskDefRow).order_by(TaskDefRow.display_id.asc())  # ty: ignore[unresolved-attribute]
        )
    ).scalars().all()
    completed_ids = await _completed_task_def_ids(session, caller.id)
    return [
        await row_to_contract_task(session, d, caller=caller, completed_ids=completed_ids)
        for d in defs
    ]


class TaskSubmitError(Exception):
    """Raised by submit_task on a business-rule violation; the router
    maps status_code 1:1 to an HTTPException."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


async def submit_task(
    session: AsyncSession,
    *,
    caller: UserRow,
    task_def: TaskDefRow,
    body: SubmitBody,
) -> TaskSubmissionResponse:
    if task_def.form_type is None:
        raise TaskSubmitError(400, "This task does not accept submissions")
    if body.form_type != task_def.form_type:
        raise TaskSubmitError(400, "form_type does not match task's declared form_type")

    completed = await _completed_task_def_ids(session, caller.id)
    requires = await _required_ids(session, task_def.id)
    if any(r not in completed for r in requires):
        raise TaskSubmitError(412, "Task prerequisites are not yet completed")

    existing = (
        await session.execute(
            select(TaskProgressRow)
            .where(TaskProgressRow.user_id == caller.id)  # ty: ignore[invalid-argument-type]
            .where(TaskProgressRow.task_def_id == task_def.id)  # ty: ignore[invalid-argument-type]
        )
    ).scalar_one_or_none()
    if existing is not None and existing.status == "completed":
        raise TaskSubmitError(409, "Task already completed")

    if existing is None:
        existing = TaskProgressRow(  # ty: ignore[missing-argument]
            user_id=caller.id,
            task_def_id=task_def.id,
        )
        session.add(existing)
    existing.status = "completed"
    existing.progress = 1.0
    existing.form_submission = body.model_dump()
    existing.completed_at = datetime.now(timezone.utc)
    await session.flush()

    reward_row = await create_reward_if_bonus(session, user=caller, task_def=task_def)
    await session.commit()

    contract_task = await row_to_contract_task(session, task_def, caller=caller)
    return TaskSubmissionResponse(
        task=contract_task,
        reward=row_to_contract_reward(reward_row) if reward_row else None,
    )
