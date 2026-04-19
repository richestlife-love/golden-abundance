# Phase 5e — Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Idempotent dev seed + final CI pass + reconcile Phase 5 with the production launch plan.

**Scope note:** "Polish" here means backend cleanup (idempotent seed, CI pass, docs sync), not frontend polish (a11y, responsive, animations, error boundaries). Frontend UI work is tracked separately under Phases 3 (routing) and 4 (wire frontend to backend) in docs/production-launch-plan.md.

**Prereqs:** phase-5d merged.

**Architecture:** Shares the scoping decisions from the Phase 5 suite — thin layered design inside `backend/` with `db/`, `auth/`, `services/`, `routers/`. SQLModel tables are the persistence shape; `backend.contract` stays untouched as the wire-format source of truth.

**Tech Stack:** Python 3.14, FastAPI, SQLModel (SQLAlchemy 2.0 async), psycopg3, Alembic, PyJWT, Pydantic Settings, uv, pytest + pytest-asyncio + httpx + testcontainers[postgresql], Postgres 17.

**Spec:** `docs/superpowers/specs/2026-04-19-phase-2-api-contract-design.md` + `backend/src/backend/contract/endpoints.md`.

**Exit criteria:** `just seed` populates T1-T4 + news items twice safely; `docs/production-launch-plan.md` marks Phase 5 complete.

---

## Scoping decisions locked before drafting

| Decision | Choice | Why |
|---|---|---|
| Field naming | snake_case end-to-end (DB, Pydantic, JSON) | Matches spec §6 and the existing contract. |

---

## File plan

Files created (C) or modified (M) by this plan. Paths are relative to repo root `/Users/Jet/Developer/golden-abundance-lite`.

| Path | Action | Contents |
|---|---|---|
| `backend/src/backend/seed.py` | C | Idempotent dev seed — creates task defs T1-T4 + a few news items |
| `backend/justfile` | M | Add `seed` recipe |
| `backend/tests/test_seed.py` | C | Seed script is idempotent (run twice, same row count) |
| `docs/production-launch-plan.md` | M | Mark Phase 5 complete |

---

## Section H — Seed, CI, and plan-doc reconciliation

**Exit criteria:** `just seed` populates a fresh local DB with task definitions T1-T4 and a handful of news items. `just ci` is green. `docs/production-launch-plan.md` reflects Phase 5 completion.

### Task H1: Seed script + `just seed` recipe

**Files:**
- Create: `backend/src/backend/seed.py`
- Modify: `backend/justfile` (add `seed` recipe)
- Create: `backend/tests/test_seed.py`

- [ ] **Step 1: Write `backend/src/backend/seed.py`**

```python
"""Idempotent dev seed. Creates task definitions (T1-T4), a few
news items, and nothing else. Users sign in via /auth/google and
complete their own profile + team.

Run with: `just -f backend/justfile seed` (after `just db-up` + `just migrate`).
Running twice is safe — existing rows (by display_id / title) are skipped.
"""

import asyncio
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.engine import get_session_maker
from backend.db.models import (
    NewsItemRow,
    TaskDefRequiresRow,
    TaskDefRow,
    TaskStepDefRow,
)


async def _upsert_task_defs(session: AsyncSession) -> dict[str, TaskDefRow]:
    existing = {
        t.display_id: t
        for t in (await session.execute(select(TaskDefRow))).scalars().all()
    }

    if "T1" not in existing:
        t1 = TaskDefRow(
            display_id="T1",
            title="填寫金富有志工表單",
            summary="完成你的志工個人資料，開啟金富有志工旅程。",
            description="歡迎加入金富有志工！請填寫基本個人資料。",
            tag="探索",
            color="#fec701",
            points=50,
            bonus=None,
            est_minutes=5,
            is_challenge=False,
            form_type="interest",
        )
        session.add(t1)
        await session.flush()
        for order, label in enumerate(
            ["確認電子郵件與手機", "填寫個人興趣與專長", "選擇可投入的時段", "簽署志工服務同意書"],
            start=1,
        ):
            session.add(TaskStepDefRow(task_def_id=t1.id, label=label, order=order))
        existing["T1"] = t1

    if "T2" not in existing:
        t2 = TaskDefRow(
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
        session.add(t2)
        await session.flush()
        existing["T2"] = t2
        # T2 requires T1
        session.add(
            TaskDefRequiresRow(task_def_id=t2.id, requires_id=existing["T1"].id)
        )

    if "T3" not in existing:
        t3 = TaskDefRow(
            display_id="T3",
            title="組成 6 人團隊",
            summary="揪齊 6 位夥伴組團衝榜。",
            description="當你的領團或加入團總人數達 6 人，任務自動完成。",
            tag="陪伴",
            color="#ff5c8a",
            points=120,
            bonus=None,
            est_minutes=0,
            is_challenge=True,
            cap=6,
            form_type=None,
        )
        session.add(t3)
        existing["T3"] = t3

    if "T4" not in existing:
        t4 = TaskDefRow(
            display_id="T4",
            title="志工培訓 (已結束)",
            summary="2026 春季培訓。",
            description="已結束，僅供參考。",
            tag="探索",
            color="#a3a3a3",
            points=0,
            bonus=None,
            est_minutes=60,
            is_challenge=False,
            form_type=None,
            due_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        )
        session.add(t4)
        existing["T4"] = t4

    await session.flush()
    return existing


async def _upsert_news(session: AsyncSession) -> None:
    from datetime import timedelta

    existing = {
        n.title
        for n in (await session.execute(select(NewsItemRow))).scalars().all()
    }
    _now = datetime.now(tz=timezone.utc)
    # News items: (title, body, category, pinned, offset_days)
    seeds = [
        ("夏季盛會志工招募開跑", "5/10 夏季盛會報名中。", "公告", True, 1),
        ("本月星點雙倍週即將開始", "4/22–28 任務星點 ×2。", "活動", False, 3),
        ("新任務「長者陪伴」已上線", "每週六下午可獲得 120 星點。", "通知", False, 5),
    ]
    for title, body, category, pinned, offset_days in seeds:
        if title in existing:
            continue
        session.add(
            NewsItemRow(
                title=title,
                body=body,
                category=category,
                pinned=pinned,
                published_at=_now - timedelta(days=offset_days),
            )
        )
    await session.flush()


async def run() -> None:
    # get_session_maker() resolves lazily against whatever engine
    # backend.db.engine is currently bound to (production by default;
    # the pytest harness rebinds via reset_engine() before calling this).
    async with get_session_maker()() as session:
        await _upsert_task_defs(session)
        await _upsert_news(session)
        await session.commit()
    print("seed: done")


if __name__ == "__main__":
    asyncio.run(run())
```

- [ ] **Step 2: Add `seed` recipe to `backend/justfile`**

Append after the `makemigration` recipe:

```justfile

# Populate dev database with task definitions and news items (idempotent)
seed:
  uv run python -m backend.seed
```

- [ ] **Step 3: Write `backend/tests/test_seed.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession

from backend.seed import run as seed_run


async def _counts(session: AsyncSession) -> tuple[int, int, int, int]:
    """Return (task_defs, news_items, requires_links, step_defs) counts."""
    from sqlalchemy import func, select
    from backend.db.models import (
        NewsItemRow,
        TaskDefRow,
        TaskDefRequiresRow,
        TaskStepDefRow,
    )
    tasks = (
        await session.execute(select(func.count()).select_from(TaskDefRow))
    ).scalar_one()
    news = (
        await session.execute(select(func.count()).select_from(NewsItemRow))
    ).scalar_one()
    reqs = (
        await session.execute(select(func.count()).select_from(TaskDefRequiresRow))
    ).scalar_one()
    steps = (
        await session.execute(select(func.count()).select_from(TaskStepDefRow))
    ).scalar_one()
    return tasks, news, reqs, steps


async def test_seed_is_idempotent(session: AsyncSession) -> None:
    # The seed script calls get_session_maker(), which resolves against
    # whatever engine backend.db.engine is bound to. conftest's session-scoped
    # fixture already called reset_engine(container_engine), so seed writes
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
    from sqlalchemy import select
    from backend.db.models import TaskDefRow
    from backend.seed import run as seed_run

    await seed_run()
    rows = (await session.execute(
        select(TaskDefRow.display_id).order_by(TaskDefRow.display_id)
    )).scalars().all()
    assert rows == ["T1", "T2", "T3", "T4"]


async def test_seed_news_has_one_pinned(session: AsyncSession) -> None:
    """Pinned flag must survive the seed — news sort depends on it."""
    from sqlalchemy import func, select
    from backend.db.models import NewsItemRow
    from backend.seed import run as seed_run

    await seed_run()
    pinned_count = (await session.execute(
        select(func.count()).select_from(NewsItemRow).where(NewsItemRow.pinned == True)  # noqa: E712
    )).scalar_one()
    assert pinned_count == 1


async def test_seed_t2_requires_t1(session: AsyncSession) -> None:
    """The T2→T1 prerequisite link must be created exactly once."""
    from sqlalchemy import select
    from backend.db.models import TaskDefRow, TaskDefRequiresRow
    from backend.seed import run as seed_run

    await seed_run()
    t1 = (await session.execute(
        select(TaskDefRow).where(TaskDefRow.display_id == "T1")
    )).scalar_one()
    t2 = (await session.execute(
        select(TaskDefRow).where(TaskDefRow.display_id == "T2")
    )).scalar_one()
    links = (await session.execute(
        select(TaskDefRequiresRow).where(
            TaskDefRequiresRow.task_def_id == t2.id,
            TaskDefRequiresRow.requires_task_def_id == t1.id,
        )
    )).scalars().all()
    assert len(links) == 1


def test_seed_runs_via_python_module_entrypoint(postgres_container, engine) -> None:
    """Smoke: `python -m backend.seed` exits 0 and prints seed: done.

    This catches (a) missing `if __name__ == '__main__'` block, (b) broken
    justfile `seed:` recipe target resolution, (c) import-time failures in
    seed.py. The unit test above exercises the Python coroutine; this test
    exercises the CLI path developers actually use.
    """
    import os
    import subprocess
    import sys
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
```

- [ ] **Step 4: Run**

```bash
(cd backend && uv run pytest tests/test_seed.py -v)
```

Expected: 5 passed. Also exercise from the shell:

```bash
# Verify the seed recipe is registered (catches typos / indentation errors):
just -f backend/justfile --list | grep -E '^\s+seed'
```

Expected: a single line listing the `seed` recipe.

```bash
just -f backend/justfile db-up
just -f backend/justfile migrate
just -f backend/justfile seed
just -f backend/justfile seed  # running again is a no-op
```

Expected output ends with `seed: done` both times, no duplicate rows.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/seed.py backend/justfile backend/tests/test_seed.py
git commit -m "$(cat <<'EOF'
phase5: add idempotent seed script + just seed

Seeds task defs T1-T4 (with steps for T1 and the T2→T1 requires link)
plus three news items. Safe to re-run — skips any row whose natural
key already exists.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task H2: Update `docs/production-launch-plan.md` + final `just ci` pass

**Files:**
- Modify: `docs/production-launch-plan.md`

- [ ] **Step 1: Mark Phase 5 tasks complete**

Edit `docs/production-launch-plan.md`. Replace the Phase 5 section:

```markdown
## Phase 5 — Persistence
- [x] Add Postgres via SQLModel
- [x] Set up Alembic migrations
- [x] Implement CRUD for each resource
```

And optionally append a note below the checkboxes:

```markdown
See Phase 5 sub-plans:
- [5a Foundation](superpowers/plans/2026-04-19-phase-5a-foundation.md)
- [5b Auth](superpowers/plans/2026-04-19-phase-5b-auth.md)
- [5c Teams](superpowers/plans/2026-04-19-phase-5c-teams.md)
- [5d Content](superpowers/plans/2026-04-19-phase-5d-content.md)
- [5e Polish](superpowers/plans/2026-04-19-phase-5e-polish.md)

Phase 5 ships the persistence layer + runnable backend via five sub-plans:
- **5a Foundation:** FastAPI + SQLModel + Postgres scaffold, `/health`, 11 tables, testcontainers harness.
- **5b Auth:** HS256 JWT + Google ID-token stub, `/auth/google`, `/auth/logout`, `/me`.
- **5c Teams:** profile completion, `/teams/*`, join-request workflow, `/me/teams`.
- **5d Content:** `/tasks/*`, `/me/tasks`, `/me/rewards`, `/rank/{users,teams}`, `/news`.
- **5e Polish:** idempotent dev seed (T1-T4 + 3 news items), `just seed` recipe.

Backend now serves every endpoint listed in `backend/src/backend/contract/endpoints.md`.
```

- [ ] **Step 2: Run full CI from scratch**

```bash
just -f backend/justfile db-up
just -f backend/justfile migrate
just -f backend/justfile ci
```

Expected: ruff (check + format) clean, `ty check` clean, `pytest` all green, coverage ≥ 90% (`pyproject.toml`'s `fail_under = 90`).

If coverage falls short, identify the uncovered modules and add targeted tests — do NOT lower the threshold.

- [ ] **Step 3: Commit**

```bash
git add docs/production-launch-plan.md
git commit -m "$(cat <<'EOF'
docs: mark Phase 5 complete

Phase 5 (persistence + runnable backend) ships per the five sub-plans in
docs/superpowers/plans/2026-04-19-phase-5{a,b,c,d,e}-*.md. All contract
endpoints live; Phase 4 (frontend wiring) can now proceed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist

**Spec coverage — this plan introduces no new endpoints; it only ships the dev seed + reconciles the launch plan. All contract endpoints are live after phase-5d merges.**

**Placeholder scan:** No `TBD` / `implement later` / "similar to task N" / "add error handling" / "write tests for the above" placeholders remain. Every code step ships complete, runnable code.

**Type consistency:**
- `seed.py` routes through `get_session_maker()` (from 5a's `backend.db.engine`) so the pytest harness's `reset_engine()` swap picks it up automatically.

**Known gaps surfaced during plan writing (documented, not blocking):**

- Seed bypasses `backend.services.display_id` and hard-codes T1-T4. Intentional: seeds must be deterministic. No test prevents drift between the display_id validator's rules and the seed's hard-coded values.
- Seed does not update pre-existing rows whose content has drifted from the seed (skip-on-conflict). Intentional: protects real dev data. Operators who want to force-refresh must truncate first.
- The `__main__` block has coverage-pragma exclusion (see pragma in seed.py).

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-19-phase-5e-polish.md`.**

The plan lives in the main repo so it's visible across worktrees. Before executing, create a worktree under `.worktree/phase-5e-polish` (per user's global instruction) so Phase-5e work stays isolated.

Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task with a two-stage review between them. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks sequentially in the current session with batch checkpoints. Use `superpowers:executing-plans`. Faster wall-clock, but the main session's context fills up quickly.

**After 5e merges, the Phase 5 suite is complete — Phase 4 (frontend wiring) can proceed.**

**Which approach would you like?**
