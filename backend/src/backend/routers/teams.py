"""Team read endpoints (list + detail). Mutations live below in
separate handlers (D5 patch + E1-E3 join-request workflow)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.contract import Paginated, Team as ContractTeam, TeamRef, TeamUpdate
from backend.db.models import TeamRow, UserRow
from backend.db.session import get_session
from backend.services.team import row_to_contract_team, search_team_refs

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
