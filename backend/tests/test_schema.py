"""Schema-drift regression tests — ensure Alembic migration output matches models.

Phase 5a uses SQLAlchemy `String(16)` (not PG enums) for all `Literal[...]`
fields. A future `alembic revision --autogenerate` must preserve this to avoid
breaking migrations that try to alter a VARCHAR into a PG enum in-place.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import SQLModel


async def test_migration_produces_every_model_table(engine: AsyncEngine) -> None:
    expected = {t.name for t in SQLModel.metadata.sorted_tables}
    async with engine.connect() as c:
        rows = await c.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'"))
        actual = {r[0] for r in rows}
    missing = expected - actual
    assert not missing, f"Migration missing tables: {missing}"


def test_migration_is_downgrade_safe(monkeypatch: pytest.MonkeyPatch) -> None:
    """`upgrade head → downgrade base → upgrade head` must round-trip cleanly.

    Catches asymmetric migrations where a column/table was added to `upgrade()`
    but the corresponding `drop` was forgotten in `downgrade()`. Runs in an
    isolated short-lived container so it can't disturb the session-scoped
    fixture that other tests share.
    """
    from pathlib import Path

    from alembic import command
    from alembic.config import Config
    from testcontainers.postgres import PostgresContainer

    alembic_ini = str(Path(__file__).parent.parent / "alembic.ini")
    with PostgresContainer("postgres:17-alpine", driver="psycopg") as pg:
        url = pg.get_connection_url()
        monkeypatch.setenv("DATABASE_URL", url)
        cfg = Config(alembic_ini)
        cfg.set_main_option("sqlalchemy.url", url)
        command.upgrade(cfg, "head")
        command.downgrade(cfg, "base")
        command.upgrade(cfg, "head")
