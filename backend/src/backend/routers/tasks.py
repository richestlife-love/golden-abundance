"""Task read + submit endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.contract import (
    SubmitBody,
    TaskSubmissionResponse,
)
from backend.contract import (
    Task as ContractTask,
)
from backend.db.models import TaskDefRow, UserRow
from backend.db.session import get_session
from backend.rate_limit import limiter
from backend.services.task import (
    TaskSubmitError,
    row_to_contract_task,
    submit_task,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/{task_id}", response_model=ContractTask)
async def get_task(
    task_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ContractTask:
    task_def = await session.get(TaskDefRow, task_id)
    if task_def is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return await row_to_contract_task(session, task_def, caller=me)


@router.post("/{task_id}/submit", response_model=TaskSubmissionResponse)
@limiter.limit("30/minute")
async def submit(
    request: Request,
    task_id: UUID,
    body: SubmitBody,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskSubmissionResponse:
    task_def = await session.get(TaskDefRow, task_id)
    if task_def is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    try:
        response = await submit_task(session, caller=me, task_def=task_def, body=body)
    except TaskSubmitError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    await session.commit()
    return response
