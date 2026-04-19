"""Team read endpoints (list + detail). Mutations live below in
separate handlers (D5 patch + E1-E3 join-request workflow)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.contract import (
    JoinRequest as ContractJoinRequest,
    Paginated,
    Team as ContractTeam,
    TeamRef,
    TeamUpdate,
)
from backend.db.models import JoinRequestRow, TeamRow, UserRow
from backend.db.session import get_session
from backend.services.team import (
    JoinConflict,
    create_join_request,
    row_to_contract_team,
    search_team_refs,
    user_to_ref,
)

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("", response_model=Paginated[TeamRef])
async def list_teams(
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
    team = await session.get(TeamRow, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return await row_to_contract_team(session, team, caller_id=me.id)


@router.patch("/{team_id}", response_model=ContractTeam)
async def update_team(
    team_id: UUID,
    body: TeamUpdate,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ContractTeam:
    team = await session.get(TeamRow, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if team.leader_id != me.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only the team leader can update it"
        )
    for field_name, value in body.model_dump(exclude_unset=True).items():
        setattr(team, field_name, value)
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
    team = await session.get(TeamRow, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    try:
        req = await create_join_request(session, team=team, requester=me)
    except JoinConflict as exc:
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
    req = await session.get(JoinRequestRow, req_id)
    if req is None or req.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.user_id != me.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the requester can cancel a join request",
        )
    await session.delete(req)
    await session.commit()
