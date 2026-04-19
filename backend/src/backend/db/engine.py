"""Async SQLAlchemy engine + session factory — lazily built on first use."""

from functools import cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.config import get_settings


@cache
def get_engine() -> AsyncEngine:
    return create_async_engine(
        get_settings().database_url,
        echo=False,
        future=True,
        pool_pre_ping=True,
    )


def get_session_maker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(bind=get_engine(), class_=AsyncSession, expire_on_commit=False)
