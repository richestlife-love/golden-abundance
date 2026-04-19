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
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlmodel import SQLModel
from testcontainers.postgres import PostgresContainer

from backend.config import get_settings
from backend.db import models as _models  # noqa: F401 — populates metadata
from backend.db.engine import get_engine, get_session_maker
from backend.db.models import TaskDefRequiresRow, TaskDefRow, TaskStepDefRow
from backend.db.session import get_session
from backend.server import create_app

_BACKEND_DIR = pathlib.Path(__file__).parent.parent


@pytest.fixture(autouse=True)
def _reset_settings_cache() -> Iterator[None]:
    """Bracket every test with a fresh ``get_settings()`` cache.

    Tests that mutate env via ``monkeypatch.setenv`` rely on
    ``get_settings()`` re-reading the environment on its next call.
    Centralising the reset here removes the need to sprinkle
    ``get_settings.cache_clear()`` around individual tests.
    """
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(scope="session")
def postgres_container() -> Iterator[PostgresContainer]:
    with PostgresContainer("postgres:17-alpine", driver="psycopg") as pg:
        yield pg


@pytest_asyncio.fixture(scope="session")
async def engine(postgres_container: PostgresContainer) -> AsyncIterator[AsyncEngine]:
    url = postgres_container.get_connection_url()

    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("DATABASE_URL", url)
        mp.setenv("APP_ENV", "test")
        if "JWT_SECRET" not in os.environ:
            mp.setenv("JWT_SECRET", "test-only-secret-32-chars-minimum")
        get_settings.cache_clear()
        get_engine.cache_clear()

        # alembic.command.upgrade is sync and spins its own event loop via
        # asyncio.run() in env.py — off-thread it so we don't deadlock.
        def _upgrade() -> None:
            from alembic import command
            from alembic.config import Config

            cfg = Config(str(_BACKEND_DIR / "alembic.ini"))
            cfg.set_main_option("script_location", str(_BACKEND_DIR / "alembic"))
            command.upgrade(cfg, "head")

        await asyncio.to_thread(_upgrade)

        eng = get_engine()
        try:
            yield eng
        finally:
            await eng.dispose()
            get_engine.cache_clear()


@pytest.fixture
def no_db_client() -> Iterator[TestClient]:
    """Sync TestClient without DB — for routes that don't touch the database."""
    with TestClient(create_app()) as c:
        yield c


@pytest_asyncio.fixture
async def session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with get_session_maker()() as s:
        yield s
    # TRUNCATE every table in a single round-trip. CASCADE makes ordering
    # irrelevant, so we skip the reverse-sorted-tables dance.
    tables = ", ".join(f'"{t.name}"' for t in SQLModel.metadata.sorted_tables)
    if tables:
        async with engine.begin() as conn:
            await conn.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    app = create_app()

    async def _override_get_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = _override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def seeded_task_defs(session: AsyncSession) -> dict[str, TaskDefRow]:
    """Seed the four prototype tasks (T1 interest form, T2 ticket form,
    T3 team challenge, T4 expired training). Returns a dict keyed by
    display_id."""

    t1 = TaskDefRow(  # ty: ignore[missing-argument]
        display_id="T1",
        title="填寫金富有志工表單",
        summary="完成你的志工個人資料,開啟金富有志工旅程。",
        description="歡迎加入金富有志工!",
        tag="探索",
        color="#fec701",
        points=50,
        bonus=None,
        est_minutes=5,
        is_challenge=False,
        form_type="interest",
    )
    t2 = TaskDefRow(  # ty: ignore[missing-argument]
        display_id="T2",
        title="夏季盛會報名",
        summary="報名 5/10 夏季盛會。",
        description="請選擇 725/726 場次票券。",
        tag="社区",
        color="#38b6ff",
        points=80,
        bonus="限定紀念徽章",
        est_minutes=10,
        is_challenge=False,
        form_type="ticket",
    )
    t3 = TaskDefRow(  # ty: ignore[missing-argument]
        display_id="T3",
        title="組成 6 人團隊",
        summary="揪齊 6 位夥伴組團衝榜。",
        description="當你的領團或加入團總人數達 6 人,任務自動完成。",
        tag="陪伴",
        color="#ff5c8a",
        points=120,
        bonus=None,
        est_minutes=0,
        is_challenge=True,
        cap=6,
        form_type=None,
    )
    t4 = TaskDefRow(  # ty: ignore[missing-argument]
        display_id="T4",
        title="志工培訓 (已結束)",
        summary="2026 春季培訓。",
        description="已結束,僅供參考。",
        tag="探索",
        color="#a3a3a3",
        points=0,
        bonus=None,
        est_minutes=60,
        is_challenge=False,
        form_type=None,
        due_at=datetime.now(timezone.utc) - timedelta(days=30),
    )
    for t in (t1, t2, t3, t4):
        session.add(t)
    await session.flush()

    step = TaskStepDefRow(task_def_id=t1.id, label="確認電子郵件與手機", order=1)
    session.add(step)

    session.add(TaskDefRequiresRow(task_def_id=t2.id, requires_id=t1.id))
    await session.commit()

    return {"T1": t1, "T2": t2, "T3": t3, "T4": t4}
