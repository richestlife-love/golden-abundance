"""Team read endpoints (list + detail). Mutations live below in
separate handlers (D5 patch + E1-E3 join-request workflow).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.contract import (
    JoinRequest as ContractJoinRequest,
)
from backend.contract import (
    Paginated,
    TeamRef,
    TeamUpdate,
)
from backend.contract import (
    Team as ContractTeam,
)
from backend.db.models import JoinRequestRow, TeamRow, UserRow
from backend.db.session import get_session
from backend.rate_limit import limiter
from backend.services.team import (
    row_to_contract_team,
    search_team_refs,
    user_to_ref,
)
from backend.services.team_join import (
    JoinConflictError,
    approve_join_request,
    create_join_request,
    leave_team,
    reject_join_request,
)

router = APIRouter(prefix="/teams", tags=["teams"])


async def _get_team_or_404(session: AsyncSession, team_id: UUID) -> TeamRow:
    team = await session.get(TeamRow, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return team


async def _get_request_or_404(session: AsyncSession, *, req_id: UUID, team_id: UUID) -> JoinRequestRow:
    req = await session.get(JoinRequestRow, req_id)
    if req is None or req.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return req


@router.get("", response_model=Paginated[TeamRef])
@limiter.limit("30/minute")
async def list_teams(
    request: Request,
    q: str | None = None,
    topic: str | None = None,
    leader_display_id: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    _: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Paginated[TeamRef]:
    return await search_team_refs(
        session,
        q=q,
        topic=topic,
        leader_display_id=leader_display_id,
        cursor=cursor,
        limit=limit,
    )


@router.get("/{team_id}", response_model=ContractTeam)
async def get_team(
    team_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ContractTeam:
    team = await _get_team_or_404(session, team_id)
    return await row_to_contract_team(session, team, caller_id=me.id)


@router.patch("/{team_id}", response_model=ContractTeam)
async def update_team(
    team_id: UUID,
    body: TeamUpdate,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ContractTeam:
    team = await _get_team_or_404(session, team_id)
    if team.leader_id != me.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can update it",
        )
    # ``TeamUpdate`` inherits ``StrictModel(extra='forbid')`` — the field
    # set is closed, so no unknown columns can be written through here.
    for field_name in body.model_fields_set:
        setattr(team, field_name, getattr(body, field_name))
    session.add(team)
    await session.commit()
    await session.refresh(team)
    return await row_to_contract_team(session, team, caller_id=me.id)


@router.post(
    "/{team_id}/join-requests",
    response_model=ContractJoinRequest,
    status_code=status.HTTP_201_CREATED,
)
async def request_to_join(
    team_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ContractJoinRequest:
    team = await _get_team_or_404(session, team_id)
    try:
        req = await create_join_request(session, team=team, requester=me)
    except JoinConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    await session.commit()
    await session.refresh(req)
    return ContractJoinRequest(
        id=req.id,
        team_id=req.team_id,
        user=user_to_ref(me),
        status=req.status,
        requested_at=req.requested_at,
    )


@router.delete(
    "/{team_id}/join-requests/{req_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def cancel_join_request(
    team_id: UUID,
    req_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    req = await _get_request_or_404(session, req_id=req_id, team_id=team_id)
    if req.user_id != me.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the requester can cancel a join request",
        )
    await session.delete(req)
    await session.commit()


@router.post("/{team_id}/join-requests/{req_id}/approve", response_model=ContractTeam)
async def approve_request(
    team_id: UUID,
    req_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ContractTeam:
    team = await _get_team_or_404(session, team_id)
    if team.leader_id != me.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the leader can approve",
        )
    req = await _get_request_or_404(session, req_id=req_id, team_id=team_id)
    await approve_join_request(session, team=team, req=req)
    await session.commit()
    await session.refresh(team)
    return await row_to_contract_team(session, team, caller_id=me.id)


@router.post(
    "/{team_id}/join-requests/{req_id}/reject",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reject_request(
    team_id: UUID,
    req_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    team = await _get_team_or_404(session, team_id)
    if team.leader_id != me.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the leader can reject",
        )
    req = await _get_request_or_404(session, req_id=req_id, team_id=team_id)
    await reject_join_request(session, req=req)
    await session.commit()


@router.post("/{team_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave(
    team_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    team = await _get_team_or_404(session, team_id)
    if team.leader_id == me.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Leaders cannot leave their own team",
        )
    await leave_team(session, team=team, user=me)
    await session.commit()
