import os
import subprocess
import sys

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import (
    NewsItemRow,
    TaskDefRequiresRow,
    TaskDefRow,
    TaskStepDefRow,
)
from backend.seed import run as seed_run


async def _counts(session: AsyncSession) -> tuple[int, int, int, int]:
    """Return (task_defs, news_items, requires_links, step_defs) counts."""
    tasks = (await session.execute(select(func.count()).select_from(TaskDefRow))).scalar_one()
    news = (await session.execute(select(func.count()).select_from(NewsItemRow))).scalar_one()
    reqs = (await session.execute(select(func.count()).select_from(TaskDefRequiresRow))).scalar_one()
    steps = (await session.execute(select(func.count()).select_from(TaskStepDefRow))).scalar_one()
    return tasks, news, reqs, steps


async def test_seed_is_idempotent(session: AsyncSession) -> None:
    # The seed script calls get_session_maker(), which resolves against
    # whatever engine backend.db.engine is bound to. conftest's session-scoped
    # engine fixture already set DATABASE_URL + cleared caches, so seed writes
    # into this testcontainer — same DB the `session` fixture reads from.
    await seed_run()
    first = await _counts(session)
    await seed_run()
    second = await _counts(session)
    assert first == second, "seed must be idempotent"
    # 4 TaskDefRow (T1-T4), 3 NewsItemRow, 1 TaskDefRequiresRow (T2→T1),
    # 4 TaskStepDefRow (T1 has 4 steps per the seed).
    assert first == (4, 3, 1, 4), f"unexpected seed shape: {first}"


async def test_seed_populates_expected_task_display_ids(
    session: AsyncSession,
) -> None:
    """Pin the task identity — catches accidental renaming to T001/etc."""
    await seed_run()
    rows = (await session.execute(select(TaskDefRow.display_id).order_by(TaskDefRow.display_id))).scalars().all()  # ty: ignore[no-matching-overload]
    assert rows == ["T1", "T2", "T3", "T4"]


async def test_seed_news_has_one_pinned(session: AsyncSession) -> None:
    """Pinned flag must survive the seed — news sort depends on it."""
    await seed_run()
    pinned_count = (
        await session.execute(
            select(func.count()).select_from(NewsItemRow).where(NewsItemRow.pinned == True)  # noqa: E712  # ty: ignore[invalid-argument-type]
        )
    ).scalar_one()
    assert pinned_count == 1


async def test_seed_t2_requires_t1(session: AsyncSession) -> None:
    """The T2→T1 prerequisite link must be created exactly once."""
    await seed_run()
    t1 = (await session.execute(select(TaskDefRow).where(TaskDefRow.display_id == "T1"))).scalar_one()  # ty: ignore[invalid-argument-type]
    t2 = (await session.execute(select(TaskDefRow).where(TaskDefRow.display_id == "T2"))).scalar_one()  # ty: ignore[invalid-argument-type]
    links = (
        (
            await session.execute(
                select(TaskDefRequiresRow).where(
                    TaskDefRequiresRow.task_def_id == t2.id,  # ty: ignore[invalid-argument-type]
                    TaskDefRequiresRow.requires_id == t1.id,  # ty: ignore[invalid-argument-type]
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(links) == 1


async def test_seed_runs_via_python_module_entrypoint(session: AsyncSession, postgres_container) -> None:
    """Smoke: `python -m backend.seed` exits 0 and prints seed: done.

    This catches (a) missing `if __name__ == '__main__'` block, (b) broken
    justfile `seed:` recipe target resolution, (c) import-time failures in
    seed.py. The unit tests above exercise the Python coroutine; this test
    exercises the CLI path developers actually use.

    We take the `session` fixture purely so its per-test TRUNCATE cleans
    up the rows this subprocess writes — otherwise downstream tests that
    seed T1-T4 via `seeded_task_defs` collide on the display_id unique
    constraint.
    """
    env = {
        **os.environ,
        "DATABASE_URL": postgres_container.get_connection_url(),
        "APP_ENV": "test",
        "JWT_SECRET": "test-only-secret-32-chars-minimum-ok",
    }
    # Use sys.executable directly — avoids relying on `uv` being on PATH
    # inside the subprocess (tests already run inside the uv-managed venv,
    # so sys.executable points at the right interpreter).
    r = subprocess.run(
        [sys.executable, "-m", "backend.seed"],
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert r.returncode == 0, f"stderr: {r.stderr}"
    assert "seed: done" in r.stdout
