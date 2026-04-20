from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.contract import (
    LeaderboardPeriod,
    Paginated,
    TeamLeaderboardEntry,
    UserLeaderboardEntry,
)
from backend.db.models import UserRow
from backend.db.session import get_session
from backend.services.leaderboard import leaderboard_teams, leaderboard_users

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("/users", response_model=Paginated[UserLeaderboardEntry])
async def get_leaderboard_users(
    period: LeaderboardPeriod = "week",
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    _: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Paginated[UserLeaderboardEntry]:
    return await leaderboard_users(session, period=period, cursor=cursor, limit=limit)


@router.get("/teams", response_model=Paginated[TeamLeaderboardEntry])
async def get_leaderboard_teams(
    period: LeaderboardPeriod = "week",
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    _: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Paginated[TeamLeaderboardEntry]:
    return await leaderboard_teams(session, period=period, cursor=cursor, limit=limit)
