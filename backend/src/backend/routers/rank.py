from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.contract import Paginated, RankPeriod, TeamRankEntry, UserRankEntry
from backend.db.models import UserRow
from backend.db.session import get_session
from backend.services.rank import leaderboard_teams, leaderboard_users

router = APIRouter(prefix="/rank", tags=["rank"])


@router.get("/users", response_model=Paginated[UserRankEntry])
async def rank_users(
    period: RankPeriod = "week",
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    _: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Paginated[UserRankEntry]:
    return await leaderboard_users(session, period=period, cursor=cursor, limit=limit)


@router.get("/teams", response_model=Paginated[TeamRankEntry])
async def rank_teams(
    period: RankPeriod = "week",
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    _: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Paginated[TeamRankEntry]:
    return await leaderboard_teams(session, period=period, cursor=cursor, limit=limit)
