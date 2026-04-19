from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.contract import NewsItem, Paginated
from backend.db.models import UserRow
from backend.db.session import get_session
from backend.services.news import list_news

router = APIRouter(prefix="/news", tags=["news"])


@router.get("", response_model=Paginated[NewsItem])
async def get_news(
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    _: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Paginated[NewsItem]:
    return await list_news(session, cursor=cursor, limit=limit)
