"""FastAPI dependency that yields an AsyncSession per request."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.engine import get_session_maker


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_session_maker()() as session:
        yield session
