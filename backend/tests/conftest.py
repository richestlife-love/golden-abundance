"""Shared pytest fixtures.

A single Postgres container is started for the whole test session
(via testcontainers) and Alembic migrations are applied against it
before any test runs — plain ``SQLModel.metadata.create_all`` would
silently paper over drift between ``db/models.py`` and the migration
files. Each test gets an AsyncSession off the shared sessionmaker;
after the test, every table is TRUNCATE'd so the next one starts
clean.
"""

import asyncio
import os
import pathlib
from collections.abc import AsyncIterator, Iterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlmodel import SQLModel
from testcontainers.postgres import PostgresContainer

from backend.db import models as _models  # noqa: F401 — populates metadata
from backend.db.engine import get_session_maker, reset_engine
from backend.db.session import get_session
from backend.server import create_app

_BACKEND_DIR = pathlib.Path(__file__).parent.parent


@pytest.fixture(scope="session")
def postgres_container() -> Iterator[PostgresContainer]:
    with PostgresContainer("postgres:17-alpine", driver="psycopg") as pg:
        yield pg


def _alembic_upgrade_head(url: str) -> None:
    """Apply migrations against ``url`` synchronously.

    Set ``DATABASE_URL`` in the environment and bust the cached
    ``get_settings()`` so ``alembic/env.py`` picks up the container
    URL when it reads ``get_settings().database_url``.
    """
    from alembic import command
    from alembic.config import Config

    from backend.config import get_settings

    os.environ["DATABASE_URL"] = url
    get_settings.cache_clear()

    cfg = Config(str(_BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(_BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")


@pytest_asyncio.fixture(scope="session")
async def engine(postgres_container: PostgresContainer) -> AsyncIterator[AsyncEngine]:
    from backend.config import get_settings

    url = postgres_container.get_connection_url()  # postgresql+psycopg://...

    # Save any pre-existing env values so we can restore them at teardown —
    # this fixture mutates DATABASE_URL / JWT_SECRET / APP_ENV to point the
    # backend at the testcontainer and test-only secrets.
    prev_db_url = os.environ.get("DATABASE_URL")
    prev_jwt_secret = os.environ.get("JWT_SECRET")
    prev_app_env = os.environ.get("APP_ENV")

    os.environ["DATABASE_URL"] = url
    os.environ.setdefault("JWT_SECRET", "test-only-secret-32-chars-minimum")
    os.environ["APP_ENV"] = "test"
    get_settings.cache_clear()

    # Apply Alembic head to the container BEFORE building the async engine.
    # Runs in a worker thread because alembic.command.upgrade is sync and
    # internally spins its own event loop via asyncio.run() in env.py.
    await asyncio.to_thread(_alembic_upgrade_head, url)

    eng = create_async_engine(url, future=True)
    # Single source of truth: any code path reaching for get_session_maker(),
    # backend.db.engine.engine, or backend.db.engine.AsyncSessionLocal now
    # routes through this engine. No second sessionmaker floating around.
    reset_engine(eng)
    try:
        yield eng
    finally:
        await eng.dispose()
        if prev_db_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = prev_db_url
        if prev_jwt_secret is None:
            os.environ.pop("JWT_SECRET", None)
        else:
            os.environ["JWT_SECRET"] = prev_jwt_secret
        if prev_app_env is None:
            os.environ.pop("APP_ENV", None)
        else:
            os.environ["APP_ENV"] = prev_app_env
        get_settings.cache_clear()


@pytest.fixture
def no_db_client() -> Iterator:
    """Sync TestClient without DB — for routes that don't touch the database."""
    from fastapi.testclient import TestClient

    with TestClient(create_app()) as c:
        yield c


@pytest_asyncio.fixture
async def session(engine) -> AsyncIterator[AsyncSession]:
    async with get_session_maker()() as s:
        yield s
    # TRUNCATE all tables between tests. The session above is closed
    # before this runs, so there's no lock contention with engine.begin().
    async with engine.begin() as conn:
        for table in reversed(SQLModel.metadata.sorted_tables):
            await conn.execute(text(f'TRUNCATE TABLE "{table.name}" RESTART IDENTITY CASCADE'))


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    app = create_app()

    async def _override_get_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = _override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
