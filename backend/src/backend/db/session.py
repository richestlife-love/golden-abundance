"""FastAPI dependency that yields an AsyncSession per request.

Delegates to ``get_session_maker()`` so the sessionmaker is resolved
lazily — the first call builds the engine against the current
``DATABASE_URL`` (or the one installed via ``reset_engine()`` in tests).
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.engine import get_session_maker


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_session_maker()() as session:
        yield session
