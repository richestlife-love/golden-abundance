# Phase 5d — Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tasks, submissions, rewards, leaderboard, and news feed.

**Prereqs:** phase-5c merged.

**Architecture:** Shares the scoping decisions from the Phase 5 suite — thin layered design inside `backend/` with `db/`, `auth/`, `services/`, `routers/`. SQLModel tables are the persistence shape; `backend.contract` stays untouched as the wire-format source of truth.

**Tech Stack:** Python 3.14, FastAPI, SQLModel (SQLAlchemy 2.0 async), psycopg3, Alembic, PyJWT, Pydantic Settings, uv, pytest + pytest-asyncio + httpx + testcontainers[postgresql], Postgres 17.

**Spec:** `docs/superpowers/specs/2026-04-19-phase-2-api-contract-design.md` + `backend/src/backend/contract/endpoints.md`.

**Exit criteria:** All task/reward/rank/news endpoints live; challenge-reward positive branch tested; cursor pagination works for teams/news.

---

## Scoping decisions locked before drafting

| Decision | Choice | Why |
|---|---|---|
| Cursor encoding | Two shapes, both `base64url(json.dumps(...))` and opaque to clients: (a) column keyset — list of sort-column values, one per `SortCol`, handled by `services.pagination.paginate_keyset` (news: `[bool, iso-ts, uuid]`; teams: `[iso-ts, uuid]`); (b) derived keyset — dict `{"pts": int, "id": str}` for rank, whose sort key is a computed aggregate and not a column that `paginate_keyset` can order over. | List form scales to composite keyset (news needs `pinned, published_at, id`) which single `{id, sort}` can't express. Dict form keeps rank's derived-value payload self-documenting. Both are opaque to clients per phase-2 spec §7 ("Backend may encode offset, last-id, or timestamp; free to change"). |
| Field naming | snake_case end-to-end (DB, Pydantic, JSON) | Matches spec §6 and the existing contract. |
| Derived fields | Computed in service layer on read | `Task.status`, `Task.progress` all derive from other columns + caller identity. |

---

## File plan

Files created (C) or modified (M) by this plan. Paths are relative to repo root `/Users/Jet/Developer/golden-abundance-lite`.

### `backend/src/backend/` — new/modified modules

| Path | Action | Contents |
|---|---|---|
| `backend/src/backend/services/task.py` | C | Merge global `TaskDefRow` + per-caller `TaskProgressRow` into contract `Task`; derive `status`/`progress`; submit handlers (interest, ticket); reward creation |
| `backend/src/backend/services/reward.py` | C | List rewards for caller; reward creation helper (called from task submit) |
| `backend/src/backend/services/rank.py` | C | Leaderboard queries for users/teams by period |
| `backend/src/backend/services/news.py` | C | List news, `pinned DESC, published_at DESC` ordering |
| `backend/src/backend/routers/tasks.py` | C | `GET /tasks/{id}`, `POST /tasks/{id}/submit` |
| `backend/src/backend/routers/me.py` | M | Add `GET /me/tasks`, `GET /me/rewards` |
| `backend/src/backend/routers/rank.py` | C | `GET /rank/users`, `GET /rank/teams` |
| `backend/src/backend/routers/news.py` | C | `GET /news` |
| `backend/src/backend/server.py` | M | Mount tasks, rank, news routers |

### `backend/tests/` — new tests

| Path | Action | Contents |
|---|---|---|
| `backend/tests/conftest.py` | M | Add `seeded_task_defs` fixture (T1-T4 + step + requires link) |
| `backend/tests/test_task_service.py` | C | status derivation (todo, locked, expired), team-challenge progress, list shape |
| `backend/tests/test_tasks_read.py` | C | `GET /tasks/{id}`, `GET /me/tasks` |
| `backend/tests/test_task_submit.py` | C | Form-type match, 400/409/412 branches, reward creation |
| `backend/tests/test_rewards_read.py` | C | `GET /me/rewards` empty + populated |
| `backend/tests/test_rank.py` | C | User + team leaderboard by period, over-max 422, cursor walk |
| `backend/tests/test_news.py` | C | Pinned-first ordering, cursor pagination, over-max 422 |

---

## Section F — Tasks, submissions, and Rewards

**Exit criteria:** `GET /tasks/{id}`, `GET /me/tasks`, `POST /tasks/{id}/submit` (with discriminated form body), `GET /me/rewards` are all live. Non-challenge tasks `status` derives from `TaskProgressRow`; challenge tasks derive `status`/`team_progress` from membership counts. Rewards are created on submit for tasks whose `TaskDef.bonus` is non-null.

**Design note — `status` derivation rules (server-authoritative, matches spec §1.3):**

For a caller `U` and task def `TD`:

1. **Locked:** If any entry in `TD.requires` does not have a completed `TaskProgressRow` for `U`, status is `"locked"`. (Regardless of other state.)
2. **Expired:** Else if `TD.due_at` is in the past and there is no completed `TaskProgressRow`, status is `"expired"`.
3. **Challenge:** Else if `TD.is_challenge`, status comes from team-size counts (`"completed"` when `total >= cap`, `"in_progress"` when `total > 0`, else `"todo"`). Never persists a TaskProgressRow for challenge tasks — they're entirely computed.
4. **Regular:** Else status comes from the `TaskProgressRow` if present; default `"todo"`.

### Task F1: Test fixture — `seeded_task_defs`

`tests/helpers.py` already exists from Task D2; this task only adds the `seeded_task_defs` fixture to `conftest.py`.

**Files:**
- Modify: `backend/tests/conftest.py` (add `seeded_task_defs` fixture)

- [ ] **Step 1: Append a fixture to `backend/tests/conftest.py`**

Hoist `datetime, timezone` to the top-level imports of `conftest.py` (they weren't there yet — add them now), then append the fixture.

```python
# Add to the top-level imports (top of conftest.py):
from datetime import datetime, timedelta, timezone

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import TaskDefRow, TaskDefRequiresRow, TaskStepDefRow


@pytest_asyncio.fixture
async def seeded_task_defs(session: AsyncSession) -> dict[str, TaskDefRow]:
    """Seed the four prototype tasks (T1 interest form, T2 ticket form,
    T3 team challenge, T4 expired training). Returns a dict keyed by
    display_id."""

    t1 = TaskDefRow(
        display_id="T1",
        title="填寫金富有志工表單",
        summary="完成你的志工個人資料，開啟金富有志工旅程。",
        description="歡迎加入金富有志工！",
        tag="探索",
        color="#fec701",
        points=50,
        bonus=None,
        est_minutes=5,
        is_challenge=False,
        form_type="interest",
    )
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
        due_at=datetime.now(timezone.utc) - timedelta(days=30),
    )
    for t in (t1, t2, t3, t4):
        session.add(t)
    await session.flush()

    # Add one step to T1 to exercise TaskStepDef mapping
    step = TaskStepDefRow(task_def_id=t1.id, label="確認電子郵件與手機", order=1)
    session.add(step)

    # T2 requires T1 to be completed first (exercises `requires` / locked rule)
    session.add(TaskDefRequiresRow(task_def_id=t2.id, requires_id=t1.id))
    await session.commit()

    return {"T1": t1, "T2": t2, "T3": t3, "T4": t4}
```

- [ ] **Step 2: Commit**

```bash
git add backend/tests/conftest.py
git commit -m "$(cat <<'EOF'
phase5: add seeded_task_defs fixture

Inserts T1-T4 defs (interest, ticket, team-challenge, expired) with
one step and the T2→T1 requires link to exercise the derivation rules.
helpers.py (already created in D2) is unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task F2: Task service — read/merge (`row_to_contract_task`, `list_caller_tasks`)

**Files:**
- Create: `backend/src/backend/services/task.py`
- Create: `backend/tests/test_task_service.py`

- [ ] **Step 1: Write `tests/test_task_service.py`**

```python
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import TaskProgressRow
from backend.services.task import list_caller_tasks, row_to_contract_task
from backend.services.user import upsert_user_by_email


async def test_task_status_todo_by_default(session: AsyncSession, seeded_task_defs) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()

    task = await row_to_contract_task(session, seeded_task_defs["T1"], caller=user)
    assert task.status == "todo"
    assert task.progress is None


async def test_task_status_locked_when_prereq_unmet(
    session: AsyncSession, seeded_task_defs
) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    # T2 requires T1; no TaskProgressRow for T1 → T2 locked
    task = await row_to_contract_task(session, seeded_task_defs["T2"], caller=user)
    assert task.status == "locked"


async def test_task_status_unlocks_when_prereq_completed(
    session: AsyncSession, seeded_task_defs
) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    session.add(
        TaskProgressRow(
            user_id=user.id,
            task_def_id=seeded_task_defs["T1"].id,
            status="completed",
            progress=1.0,
        )
    )
    await session.commit()
    task = await row_to_contract_task(session, seeded_task_defs["T2"], caller=user)
    assert task.status == "todo"


async def test_task_status_expired_for_past_due(
    session: AsyncSession, seeded_task_defs
) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    task = await row_to_contract_task(session, seeded_task_defs["T4"], caller=user)
    assert task.status == "expired"


async def test_challenge_task_computes_team_progress(
    session: AsyncSession, seeded_task_defs
) -> None:
    from backend.db.models import TeamMembershipRow
    from backend.services.team import create_led_team

    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    team = await create_led_team(session, user)
    # Add 2 other members to the leader's team (leader + 2 others = 3)
    for email in ("a@example.com", "b@example.com"):
        m = await upsert_user_by_email(session, email=email)
        await session.flush()
        session.add(TeamMembershipRow(team_id=team.id, user_id=m.id))
    await session.commit()

    task = await row_to_contract_task(session, seeded_task_defs["T3"], caller=user)
    assert task.team_progress is not None
    assert task.team_progress.cap == 6
    assert task.team_progress.led_total == 3
    assert task.team_progress.total == 3
    assert task.status == "in_progress"


async def test_challenge_at_cap_is_completed(
    session: AsyncSession, seeded_task_defs
) -> None:
    """When total == cap, status must flip to 'completed' (reward trigger edge)."""
    from backend.db.models import TeamMembershipRow
    from backend.services.team import create_led_team

    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    team = await create_led_team(session, user)
    # Leader + 5 members = 6 members = T3's cap.
    for i in range(5):
        m = await upsert_user_by_email(session, email=f"m{i}@example.com")
        await session.flush()
        session.add(TeamMembershipRow(team_id=team.id, user_id=m.id))
    await session.commit()

    task = await row_to_contract_task(session, seeded_task_defs["T3"], caller=user)
    assert task.team_progress is not None
    assert task.team_progress.total == 6
    assert task.team_progress.cap == 6
    assert task.status == "completed"


async def test_challenge_joined_total_wins_when_higher(
    session: AsyncSession, seeded_task_defs
) -> None:
    """Spec §1.3: total = max(led_total, joined_total).

    A caller leading a 2-person team but joined to a 5-person team should
    see total=5. Regression that drops the max() and uses led_total alone
    would silently misreport challenge progress.
    """
    from backend.db.models import TeamMembershipRow
    from backend.services.team import create_led_team

    caller = await upsert_user_by_email(session, email="caller@example.com")
    other_leader = await upsert_user_by_email(session, email="leader@example.com")
    await session.flush()
    own_team = await create_led_team(session, caller)
    other_team = await create_led_team(session, other_leader)

    # Caller's led team has 2 members total (caller + 1).
    extra = await upsert_user_by_email(session, email="own@example.com")
    await session.flush()
    session.add(TeamMembershipRow(team_id=own_team.id, user_id=extra.id))

    # Other team has 5 members, and caller is one of them.
    session.add(TeamMembershipRow(team_id=other_team.id, user_id=caller.id))
    for i in range(3):
        m = await upsert_user_by_email(session, email=f"other{i}@example.com")
        await session.flush()
        session.add(TeamMembershipRow(team_id=other_team.id, user_id=m.id))
    await session.commit()

    task = await row_to_contract_task(session, seeded_task_defs["T3"], caller=caller)
    assert task.team_progress is not None
    assert task.team_progress.led_total == 2
    assert task.team_progress.joined_total == 5
    assert task.team_progress.total == 5


async def test_list_caller_tasks_returns_all(
    session: AsyncSession, seeded_task_defs
) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    tasks = await list_caller_tasks(session, caller=user)
    assert len(tasks) == 4
    ids = {t.display_id for t in tasks}
    assert ids == {"T1", "T2", "T3", "T4"}
```

- [ ] **Step 2: Run — expect ImportError**

- [ ] **Step 3: Write `services/task.py`**

```python
"""Task service: merge global TaskDef + per-caller state into the
contract `Task` shape. Enforces the derivation rules from spec §1.3.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import Task as ContractTask
from backend.contract import TaskStep as ContractTaskStep
from backend.contract import TeamChallengeProgress
from backend.db.models import (
    TaskDefRequiresRow,
    TaskDefRow,
    TaskProgressRow,
    TaskStepDefRow,
    TaskStepProgressRow,
    TeamMembershipRow,
    TeamRow,
    UserRow,
)


async def _completed_task_def_ids(session: AsyncSession, user_id: UUID) -> set[UUID]:
    rows = (
        await session.execute(
            select(TaskProgressRow.task_def_id)
            .where(TaskProgressRow.user_id == user_id)
            .where(TaskProgressRow.status == "completed")
        )
    ).all()
    return {row[0] for row in rows}


async def _required_ids(session: AsyncSession, task_def_id: UUID) -> list[UUID]:
    rows = (
        await session.execute(
            select(TaskDefRequiresRow.requires_id).where(
                TaskDefRequiresRow.task_def_id == task_def_id
            )
        )
    ).all()
    return [row[0] for row in rows]


async def _team_totals(
    session: AsyncSession, caller: UserRow, *, cap: int
) -> TeamChallengeProgress:
    led = (
        await session.execute(select(TeamRow).where(TeamRow.leader_id == caller.id))
    ).scalar_one_or_none()
    joined_link = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.user_id == caller.id)
        )
    ).scalar_one_or_none()

    led_total = 0
    if led is not None:
        led_members = (
            await session.execute(
                select(TeamMembershipRow).where(TeamMembershipRow.team_id == led.id)
            )
        ).scalars().all()
        led_total = 1 + len(led_members)

    joined_total = 0
    if joined_link is not None:
        joined_team = await session.get(TeamRow, joined_link.team_id)
        if joined_team is not None:
            mems = (
                await session.execute(
                    select(TeamMembershipRow).where(
                        TeamMembershipRow.team_id == joined_team.id
                    )
                )
            ).scalars().all()
            joined_total = 1 + len(mems)

    return TeamChallengeProgress(
        total=max(led_total, joined_total),
        cap=cap,
        led_total=led_total,
        joined_total=joined_total,
    )


async def _steps_for(
    session: AsyncSession, task_def_id: UUID, user_id: UUID
) -> list[ContractTaskStep]:
    defs = (
        await session.execute(
            select(TaskStepDefRow)
            .where(TaskStepDefRow.task_def_id == task_def_id)
            .order_by(TaskStepDefRow.order.asc())
        )
    ).scalars().all()
    if not defs:
        return []
    step_ids = [d.id for d in defs]
    progress_rows = (
        await session.execute(
            select(TaskStepProgressRow)
            .where(TaskStepProgressRow.user_id == user_id)
            .where(TaskStepProgressRow.step_id.in_(step_ids))
        )
    ).scalars().all()
    done_map = {r.step_id: r.done for r in progress_rows}
    return [
        ContractTaskStep(
            id=d.id, label=d.label, done=done_map.get(d.id, False), order=d.order
        )
        for d in defs
    ]


async def row_to_contract_task(
    session: AsyncSession, task_def: TaskDefRow, *, caller: UserRow
) -> ContractTask:
    completed_ids = await _completed_task_def_ids(session, caller.id)
    requires = await _required_ids(session, task_def.id)

    progress_row = (
        await session.execute(
            select(TaskProgressRow)
            .where(TaskProgressRow.user_id == caller.id)
            .where(TaskProgressRow.task_def_id == task_def.id)
        )
    ).scalar_one_or_none()

    if task_def.is_challenge:
        if task_def.cap is None:
            raise RuntimeError(
                f"Challenge task {task_def.display_id} is missing cap — "
                "is_challenge=True requires a non-null cap."
            )
        team_progress = await _team_totals(session, caller, cap=task_def.cap)
    else:
        team_progress = None

    # Derive status
    locked = any(req not in completed_ids for req in requires)
    now = datetime.now(timezone.utc)

    if locked:
        status = "locked"
    elif (
        task_def.due_at is not None
        and task_def.due_at < now
        and (progress_row is None or progress_row.status != "completed")
    ):
        status = "expired"
    elif task_def.is_challenge:
        assert team_progress is not None
        if team_progress.total >= team_progress.cap:
            status = "completed"
        elif team_progress.total > 0:
            status = "in_progress"
        else:
            status = "todo"
    else:
        status = progress_row.status if progress_row else "todo"

    if task_def.is_challenge:
        assert team_progress is not None
        progress_value: float | None = min(team_progress.total / team_progress.cap, 1.0)
    else:
        progress_value = progress_row.progress if progress_row else None

    steps = await _steps_for(session, task_def.id, caller.id)

    return ContractTask(
        id=task_def.id,
        display_id=task_def.display_id,
        title=task_def.title,
        summary=task_def.summary,
        description=task_def.description,
        tag=task_def.tag,  # type: ignore[arg-type]
        color=task_def.color,
        points=task_def.points,
        bonus=task_def.bonus,
        due_at=task_def.due_at,
        est_minutes=task_def.est_minutes,
        is_challenge=task_def.is_challenge,
        requires=requires,
        cap=task_def.cap,
        form_type=task_def.form_type,  # type: ignore[arg-type]
        status=status,  # type: ignore[arg-type]
        progress=progress_value,
        steps=steps,
        team_progress=team_progress,
        created_at=task_def.created_at,
    )


async def list_caller_tasks(
    session: AsyncSession, *, caller: UserRow
) -> list[ContractTask]:
    defs = (
        await session.execute(
            select(TaskDefRow).order_by(TaskDefRow.display_id.asc())
        )
    ).scalars().all()
    return [await row_to_contract_task(session, d, caller=caller) for d in defs]
```

- [ ] **Step 4: Run tests**

```bash
(cd backend && uv run pytest tests/test_task_service.py -v)
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/services/task.py backend/tests/test_task_service.py
git commit -m "$(cat <<'EOF'
phase5: add task service with status/progress derivation

Enforces the locked/expired/challenge/regular rules from spec §1.3.
Challenge tasks never read a TaskProgressRow — their state is the team
size vs cap. Steps attach per-user done bits via TaskStepProgressRow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task F3: GET /tasks/{id} + GET /me/tasks

**Files:**
- Create: `backend/src/backend/routers/tasks.py`
- Modify: `backend/src/backend/routers/me.py` (add /me/tasks)
- Modify: `backend/src/backend/server.py` (mount tasks router)
- Create: `backend/tests/test_tasks_read.py`

- [ ] **Step 1: Write `tests/test_tasks_read.py`**

```python
from httpx import AsyncClient

from tests.helpers import sign_in_and_complete


async def test_get_task_by_id(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t1_id = seeded_task_defs["T1"].id

    response = await client.get(f"/api/v1/tasks/{t1_id}", headers=h)
    assert response.status_code == 200
    data = response.json()
    assert data["display_id"] == "T1"
    # T1 has at least one step from the seed fixture.
    assert "steps" in data
    assert isinstance(data["steps"], list)
    for step in data["steps"]:
        assert "label" in step
        assert "done" in step


async def test_get_task_404(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get(
        "/api/v1/tasks/00000000-0000-0000-0000-000000000000", headers=h
    )
    assert response.status_code == 404


async def test_list_me_tasks_returns_all_four(
    client: AsyncClient, seeded_task_defs
) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/me/tasks", headers=h)
    assert response.status_code == 200
    data = response.json()
    assert {t["display_id"] for t in data} == {"T1", "T2", "T3", "T4"}


async def test_t2_locked_until_t1_completed_visible_in_list(
    client: AsyncClient, seeded_task_defs
) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/me/tasks", headers=h)
    by_did = {t["display_id"]: t for t in response.json()}
    assert by_did["T2"]["status"] == "locked"
    assert by_did["T4"]["status"] == "expired"
```

- [ ] **Step 2: Write `routers/tasks.py`**

```python
"""Task read + submit endpoints. Submit lands in F4."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.contract import Task as ContractTask
from backend.db.models import TaskDefRow, UserRow
from backend.db.session import get_session
from backend.services.task import row_to_contract_task

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/{task_id}", response_model=ContractTask)
async def get_task(
    task_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ContractTask:
    task_def = await session.get(TaskDefRow, task_id)
    if task_def is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return await row_to_contract_task(session, task_def, caller=me)
```

- [ ] **Step 3: Append to `routers/me.py`**

```python
from backend.services.task import list_caller_tasks


@router.get("/tasks", response_model=list[ContractTask])
async def get_me_tasks(
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ContractTask]:
    return await list_caller_tasks(session, caller=me)
```

Also add to imports: `from backend.contract import Task as ContractTask`.

- [ ] **Step 4: Mount tasks router in `server.py`**

```python
from backend.routers import auth, health, me, tasks, teams

# in create_app():
app.include_router(tasks.router, prefix=API_V1)
```

- [ ] **Step 5: Run tests**

```bash
(cd backend && uv run pytest tests/test_tasks_read.py -v)
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/backend/routers/tasks.py backend/src/backend/routers/me.py backend/src/backend/server.py backend/tests/test_tasks_read.py
git commit -m "$(cat <<'EOF'
phase5: add GET /tasks/{id} and GET /me/tasks

Read-only endpoints using the merged service. locked/expired
derivation is visible through the list shape without any caller-side
recomputation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task F4: POST /tasks/{id}/submit + reward creation

**Files:**
- Modify: `backend/src/backend/services/task.py` (append `submit_task`)
- Create: `backend/src/backend/services/reward.py`
- Modify: `backend/src/backend/routers/tasks.py` (append submit handler)
- Create: `backend/tests/test_task_submit.py`

- [ ] **Step 1: Write `tests/test_task_submit.py`**

```python
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.helpers import sign_in_and_complete

_INTEREST = {
    "form_type": "interest",
    "name": "Jet",
    "phone": "912345678",
    "interests": ["探索"],
    "skills": [],
    "availability": ["週末"],
}

_TICKET = {
    "form_type": "ticket",
    "name": "Jet",
    "ticket_725": "ABC-725",
    "ticket_726": "ABC-726",
    "note": None,
}


async def test_submit_interest_marks_completed(
    client: AsyncClient, seeded_task_defs
) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t1 = seeded_task_defs["T1"].id

    response = await client.post(f"/api/v1/tasks/{t1}/submit", json=_INTEREST, headers=h)
    assert response.status_code == 200
    data = response.json()
    assert data["task"]["status"] == "completed"
    assert data["task"]["progress"] == 1.0
    assert data["reward"] is None  # T1 has no bonus


async def test_submit_ticket_creates_reward(
    client: AsyncClient, seeded_task_defs
) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t1 = seeded_task_defs["T1"].id
    t2 = seeded_task_defs["T2"].id

    # Unlock T2 by completing T1 first
    await client.post(f"/api/v1/tasks/{t1}/submit", json=_INTEREST, headers=h)
    response = await client.post(f"/api/v1/tasks/{t2}/submit", json=_TICKET, headers=h)
    assert response.status_code == 200
    assert response.json()["reward"] is not None
    assert response.json()["reward"]["bonus"] == "限定紀念徽章"
    assert response.json()["reward"]["status"] == "earned"


async def test_submit_wrong_form_type_400(
    client: AsyncClient, seeded_task_defs
) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t1 = seeded_task_defs["T1"].id
    response = await client.post(f"/api/v1/tasks/{t1}/submit", json=_TICKET, headers=h)
    assert response.status_code == 400


async def test_submit_locked_task_412(
    client: AsyncClient, seeded_task_defs
) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t2 = seeded_task_defs["T2"].id
    response = await client.post(f"/api/v1/tasks/{t2}/submit", json=_TICKET, headers=h)
    assert response.status_code == 412


async def test_submit_twice_returns_409(
    client: AsyncClient, seeded_task_defs
) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t1 = seeded_task_defs["T1"].id
    await client.post(f"/api/v1/tasks/{t1}/submit", json=_INTEREST, headers=h)
    second = await client.post(f"/api/v1/tasks/{t1}/submit", json=_INTEREST, headers=h)
    assert second.status_code == 409


async def test_submit_to_formless_task_400(
    client: AsyncClient, seeded_task_defs
) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t3 = seeded_task_defs["T3"].id  # challenge, no form
    response = await client.post(f"/api/v1/tasks/{t3}/submit", json=_INTEREST, headers=h)
    assert response.status_code == 400
    assert "does not accept submissions" in response.json()["detail"].lower()


async def test_submit_to_nonexistent_task_404(
    client: AsyncClient, seeded_task_defs
) -> None:
    from uuid import uuid4
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.post(
        f"/api/v1/tasks/{uuid4()}/submit",
        json=_INTEREST,
        headers=jet.headers,
    )
    assert r.status_code == 404


async def test_submit_interest_with_empty_list_is_422(
    client: AsyncClient, seeded_task_defs
) -> None:
    """Contract declares `interests: list[str] = Field(min_length=1)`.

    A regression that drops the min_length would silently accept empty
    submissions. Pydantic catches this before reaching the service.
    """
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.post(
        f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit",
        json={"form_type": "interest", "interests": []},
        headers=jet.headers,
    )
    assert r.status_code == 422


async def test_submit_t2_twice_does_not_create_second_reward(
    client: AsyncClient, session: AsyncSession, seeded_task_defs
) -> None:
    """Bonus-carrying tasks must not double-issue rewards on resubmit."""
    from sqlalchemy import func, select
    from backend.db.models import RewardRow

    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    # Unlock T2 by completing T1.
    await client.post(f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit",
                      json=_INTEREST, headers=jet.headers)
    await client.post(f"/api/v1/tasks/{seeded_task_defs['T2'].id}/submit",
                      json=_TICKET, headers=jet.headers)
    r2 = await client.post(f"/api/v1/tasks/{seeded_task_defs['T2'].id}/submit",
                           json=_TICKET, headers=jet.headers)
    assert r2.status_code == 409

    count = (await session.execute(
        select(func.count()).select_from(RewardRow).where(RewardRow.user_id == jet.user_id)
    )).scalar_one()
    assert count == 1


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", f"/api/v1/tasks/{uuid4()}"),
        ("POST", f"/api/v1/tasks/{uuid4()}/submit"),
        ("GET", "/api/v1/me/tasks"),
        ("GET", "/api/v1/me/rewards"),
        ("GET", "/api/v1/rank/users"),
        ("GET", "/api/v1/rank/teams"),
        ("GET", "/api/v1/news"),
    ],
)
async def test_phase_5d_endpoint_requires_auth(
    client: AsyncClient, method: str, path: str
) -> None:
    r = await client.request(method, path)
    assert r.status_code == 401, f"{method} {path} should require auth"
```

- [ ] **Step 2: Write `services/reward.py`**

```python
"""Reward service: list + creation on task completion."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import Reward as ContractReward
from backend.db.models import RewardRow, TaskDefRow, UserRow


async def create_reward_if_bonus(
    session: AsyncSession, *, user: UserRow, task_def: TaskDefRow
) -> RewardRow | None:
    if task_def.bonus is None:
        return None
    row = RewardRow(
        user_id=user.id,
        task_def_id=task_def.id,
        task_title=task_def.title,
        bonus=task_def.bonus,
        status="earned",
    )
    session.add(row)
    await session.flush()
    return row


def row_to_contract_reward(row: RewardRow) -> ContractReward:
    return ContractReward(
        id=row.id,
        user_id=row.user_id,
        task_id=row.task_def_id,
        task_title=row.task_title,
        bonus=row.bonus,
        status=row.status,  # type: ignore[arg-type]
        earned_at=row.earned_at,
        claimed_at=row.claimed_at,
    )


async def list_rewards_for(
    session: AsyncSession, user: UserRow
) -> list[ContractReward]:
    rows = (
        await session.execute(
            select(RewardRow)
            .where(RewardRow.user_id == user.id)
            .order_by(RewardRow.earned_at.desc())
        )
    ).scalars().all()
    return [row_to_contract_reward(r) for r in rows]
```

- [ ] **Step 3: Append `submit_task` to `services/task.py`**

```python
from backend.contract import SubmitBody, TaskSubmissionResponse
from backend.services.reward import create_reward_if_bonus, row_to_contract_reward


class TaskSubmitError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


async def submit_task(
    session: AsyncSession,
    *,
    caller: UserRow,
    task_def: TaskDefRow,
    body: SubmitBody,
) -> TaskSubmissionResponse:
    # Validate form compatibility
    if task_def.form_type is None:
        raise TaskSubmitError(400, "This task does not accept submissions")
    if body.form_type != task_def.form_type:
        raise TaskSubmitError(400, "form_type does not match task's declared form_type")

    # Locked? prerequisites must be completed first.
    completed = await _completed_task_def_ids(session, caller.id)
    requires = await _required_ids(session, task_def.id)
    if any(r not in completed for r in requires):
        raise TaskSubmitError(412, "Task prerequisites are not yet completed")

    # Already completed? 409 (no idempotent re-submit).
    existing = (
        await session.execute(
            select(TaskProgressRow)
            .where(TaskProgressRow.user_id == caller.id)
            .where(TaskProgressRow.task_def_id == task_def.id)
        )
    ).scalar_one_or_none()
    if existing is not None and existing.status == "completed":
        raise TaskSubmitError(409, "Task already completed")

    if existing is None:
        existing = TaskProgressRow(
            user_id=caller.id,
            task_def_id=task_def.id,
        )
        session.add(existing)
    existing.status = "completed"
    existing.progress = 1.0
    existing.form_submission = body.model_dump()
    existing.completed_at = datetime.now(timezone.utc)
    await session.flush()

    reward_row = await create_reward_if_bonus(session, user=caller, task_def=task_def)
    await session.commit()

    contract_task = await row_to_contract_task(session, task_def, caller=caller)
    return TaskSubmissionResponse(
        task=contract_task,
        reward=row_to_contract_reward(reward_row) if reward_row else None,
    )
```

- [ ] **Step 4: Append submit handler to `routers/tasks.py`**

```python
from backend.contract import SubmitBody, TaskSubmissionResponse
from backend.services.task import TaskSubmitError, submit_task


@router.post("/{task_id}/submit", response_model=TaskSubmissionResponse)
async def submit(
    task_id: UUID,
    body: SubmitBody,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskSubmissionResponse:
    task_def = await session.get(TaskDefRow, task_id)
    if task_def is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    try:
        return await submit_task(session, caller=me, task_def=task_def, body=body)
    except TaskSubmitError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
```

- [ ] **Step 5: Run tests**

```bash
(cd backend && uv run pytest tests/test_task_submit.py -v)
```

Expected: 17 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/backend/services/task.py backend/src/backend/services/reward.py backend/src/backend/routers/tasks.py backend/tests/test_task_submit.py
git commit -m "$(cat <<'EOF'
phase5: add POST /tasks/{id}/submit + reward creation

Discriminated InterestFormBody|TicketFormBody body, 400 on form mismatch,
412 on unmet requires, 409 on double-submit, 200 with
{task, reward} otherwise. create_reward_if_bonus persists a RewardRow
only when TaskDef.bonus is non-null.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task F5: GET /me/rewards

**Files:**
- Modify: `backend/src/backend/routers/me.py` (append)
- Create: `backend/tests/test_rewards_read.py`

- [ ] **Step 1: Write `tests/test_rewards_read.py`**

```python
from httpx import AsyncClient

from tests.helpers import sign_in_and_complete

_INTEREST = {
    "form_type": "interest",
    "name": "Jet",
    "phone": "912345678",
    "interests": ["探索"],
    "skills": [],
    "availability": ["週末"],
}
_TICKET = {
    "form_type": "ticket",
    "name": "Jet",
    "ticket_725": "ABC-725",
    "ticket_726": "ABC-726",
    "note": None,
}


async def test_rewards_empty_for_new_user(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/me/rewards", headers=h)
    assert response.status_code == 200
    assert response.json() == []


async def test_reward_appears_after_bonus_task(
    client: AsyncClient, seeded_task_defs
) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    t1 = seeded_task_defs["T1"].id
    t2 = seeded_task_defs["T2"].id
    await client.post(f"/api/v1/tasks/{t1}/submit", json=_INTEREST, headers=h)
    await client.post(f"/api/v1/tasks/{t2}/submit", json=_TICKET, headers=h)

    response = await client.get("/api/v1/me/rewards", headers=h)
    assert response.status_code == 200
    rewards = response.json()
    assert len(rewards) == 1
    assert rewards[0]["bonus"] == "限定紀念徽章"


async def test_me_rewards_is_scoped_to_caller(
    client: AsyncClient, seeded_task_defs
) -> None:
    """A missing `WHERE user_id = :caller` would leak rewards across users."""
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")

    # Jet completes T1 then T2 (T2 has a bonus → earns a reward).
    await client.post(f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit",
                      json=_INTEREST, headers=jet.headers)
    await client.post(f"/api/v1/tasks/{seeded_task_defs['T2'].id}/submit",
                      json=_TICKET, headers=jet.headers)

    jet_rewards = (await client.get("/api/v1/me/rewards", headers=jet.headers)).json()
    out_rewards = (await client.get("/api/v1/me/rewards", headers=out.headers)).json()

    # /me/rewards returns a bare list (response_model=list[ContractReward]).
    assert len(jet_rewards) == 1
    assert len(out_rewards) == 0
```

- [ ] **Step 2: Append to `routers/me.py`**

```python
from backend.contract import Reward as ContractReward
from backend.services.reward import list_rewards_for


@router.get("/rewards", response_model=list[ContractReward])
async def get_me_rewards(
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ContractReward]:
    return await list_rewards_for(session, me)
```

- [ ] **Step 3: Run tests**

```bash
(cd backend && uv run pytest tests/test_rewards_read.py -v)
```

Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/src/backend/routers/me.py backend/tests/test_rewards_read.py
git commit -m "$(cat <<'EOF'
phase5: add GET /me/rewards

Lists earned rewards most-recent first. Only tasks with non-null
TaskDef.bonus ever generate rows here, matching the contract
invariant that Reward.bonus is always non-null.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Section G — Rank + News

**Exit criteria:** `GET /rank/users`, `GET /rank/teams`, `GET /news` return cursor-paginated data. Rank values derive dynamically from completed task points (no denormalization); over-max `limit` returns 422.

**Design notes:**

- **User points:** `sum(TaskDef.points) for each TaskProgressRow with status="completed"`.
- **Team points:** sum of all member points (leader + members).
- **Period window:** `week` = last 7 days of `TaskProgressRow.completed_at`; `month` = last 30 days; `all_time` = no filter.
- **News order:** `pinned DESC, published_at DESC, id DESC`. Cursor is `(pinned, published_at, id)` — Postgres tuple comparison handles the "next page" predicate cleanly.

### Task G1: `services/rank.py` + tests

**Files:**
- Create: `backend/src/backend/services/rank.py`
- Create: `backend/tests/test_rank.py`

- [ ] **Step 1: Write `tests/test_rank.py`**

```python
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.helpers import sign_in_and_complete

_INTEREST = {
    "form_type": "interest",
    "name": "Jet",
    "phone": "912345678",
    "interests": ["x"],
    "skills": [],
    "availability": ["週末"],
}


async def test_rank_users_sorts_by_points_desc(
    client: AsyncClient, seeded_task_defs
) -> None:
    # Jet completes T1 (50 pts), Wei completes nothing
    h_jet, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    await client.post(f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit", json=_INTEREST, headers=h_jet)
    await sign_in_and_complete(client, "wei@example.com", "偉")

    response = await client.get("/api/v1/rank/users?period=all_time", headers=h_jet)
    assert response.status_code == 200
    items = response.json()["items"]
    assert items[0]["user"]["display_id"]  # shape check
    # Jet ranks first with 50 points
    assert len(items) == 2
    assert items[0]["points"] == 50
    assert items[0]["rank"] == 1
    assert items[1]["points"] == 0
    assert items[1]["rank"] == 2


async def test_rank_users_over_max_limit_422(client: AsyncClient, seeded_task_defs) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/rank/users?limit=101", headers=h)
    assert response.status_code == 422


async def test_rank_teams_zero_when_no_completions(
    client: AsyncClient, seeded_task_defs
) -> None:
    h, *_ = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/rank/teams", headers=h)
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) >= 1
    assert items[0]["points"] == 0


async def test_rank_users_cursor_walks_to_end(
    client: AsyncClient, seeded_task_defs
) -> None:
    # Three signed-in users with zero-point rosters; pagination size=1 walks
    # through all three across three calls and reports next_cursor=None on
    # the last page.
    h1, *_ = await sign_in_and_complete(client, "a@example.com", "A")
    await sign_in_and_complete(client, "b@example.com", "B")
    await sign_in_and_complete(client, "c@example.com", "C")

    seen_ids: list[str] = []
    cursor: str | None = None
    for _ in range(4):  # 3 pages + guard against infinite loop
        url = "/api/v1/rank/users?period=all_time&limit=1"
        if cursor:
            url += f"&cursor={cursor}"
        response = await client.get(url, headers=h1)
        assert response.status_code == 200
        data = response.json()
        seen_ids.extend(item["user"]["id"] for item in data["items"])
        cursor = data["next_cursor"]
        if cursor is None:
            break
    assert cursor is None
    assert len(seen_ids) == 3
    assert len(set(seen_ids)) == 3  # no dups


async def test_rank_users_week_filters_out_old_completions(
    session: AsyncSession, client: AsyncClient, seeded_task_defs
) -> None:
    """Completion >7 days old must appear in all_time but NOT in week.

    The plan's `_user_points_map` branches on period via `_since()`. Without this
    test, the period filter could be silently deleted.
    """
    from datetime import datetime, timedelta, timezone
    from backend.db.models import TaskProgressRow

    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    session.add(TaskProgressRow(
        user_id=jet.user_id,
        task_def_id=seeded_task_defs["T1"].id,
        status="completed",
        progress=1.0,
        completed_at=datetime.now(timezone.utc) - timedelta(days=10),
    ))
    await session.commit()

    week = (await client.get(
        "/api/v1/rank/users?period=week", headers=jet.headers
    )).json()
    all_time = (await client.get(
        "/api/v1/rank/users?period=all_time", headers=jet.headers
    )).json()

    jet_week = next(i for i in week["items"] if i["user"]["id"] == str(jet.user_id))
    jet_all = next(i for i in all_time["items"] if i["user"]["id"] == str(jet.user_id))
    assert jet_week["points"] == 0
    assert jet_all["points"] == 50
    # week_points must reflect 7-day window even under period=all_time.
    assert jet_all["week_points"] == 0


async def test_rank_users_garbage_cursor_returns_400(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.get(
        "/api/v1/rank/users?cursor=not-a-real-cursor", headers=jet.headers
    )
    assert r.status_code == 400


async def test_rank_users_wrong_shape_cursor_returns_400(client: AsyncClient) -> None:
    """A cursor whose payload shape is wrong must 400, not 500."""
    from backend.services.pagination import encode_cursor
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    # A news-shaped cursor (list payload) used on rank (which expects dict).
    wrong = encode_cursor([True, "2026-04-18T00:00:00+00:00", "not-a-uuid"])
    r = await client.get(
        f"/api/v1/rank/users?cursor={wrong}", headers=jet.headers
    )
    assert r.status_code == 400


async def test_rank_users_ties_break_by_user_id(
    session: AsyncSession, client: AsyncClient, seeded_task_defs
) -> None:
    """Users with equal points must sort deterministically by str(id) ascending."""
    # Both users complete T1 (same points). Verify rank 1 is the lower UUID.
    a = await sign_in_and_complete(client, "a@example.com", "A")
    b = await sign_in_and_complete(client, "b@example.com", "B")
    for u in (a, b):
        await client.post(f"/api/v1/tasks/{seeded_task_defs['T1'].id}/submit",
                          json=_INTEREST, headers=u.headers)
    data = (await client.get("/api/v1/rank/users?period=all_time", headers=a.headers)).json()
    ids = [i["user"]["id"] for i in data["items"]]
    assert ids == sorted(ids)
```

- [ ] **Step 2: Write `services/rank.py`**

```python
"""Leaderboard queries. Computes points dynamically from completed
task progress rows. Fine for Phase-5 data volume; denormalize to
UserRow.points / TeamRow.points columns if the view ever gets slow.

The ``next_cursor`` is an opaque base64(JSON) of the last-returned
entry's ``(points, id)`` tuple. The next page filters by
``(points < cursor_points) OR (points == cursor_points AND id > cursor_id)``
— which, under our ORDER BY ``points DESC, id ASC``, is strict
"after-cursor" ordering. This is stable under concurrent writes: a
given row's ``id`` never changes and its ``points`` only changes when
that user/team earns new points, so the cursor boundary is well-defined
per row rather than per offset. The only drift case (user A's points
increase between page fetches, bumping A back across the cursor) is
bounded to A, not cascading to everyone after.

For Phase-5 data volume we still rank in Python after loading rows;
denormalize to a window-function SQL query if the set ever grows past
a few thousand.

TODO(phase-6): rewrite as a single SQL with
``ROW_NUMBER() OVER (ORDER BY points DESC, id ASC)`` projected as
``rank``, then keyset-paginate using ``services.pagination.paginate_keyset``
over ``(points DESC, id ASC)``. That removes the "load every user/team
into Python" pattern and scales to 10k+ rows.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import (
    Paginated,
    RankPeriod,
    TeamRankEntry,
    TeamRef,
    UserRankEntry,
    UserRef,
)
from backend.db.models import (
    TaskDefRow,
    TaskProgressRow,
    TeamMembershipRow,
    TeamRow,
    UserRow,
)
from backend.services.pagination import decode_cursor, encode_cursor


def _since(period: RankPeriod) -> datetime | None:
    now = datetime.now(timezone.utc)
    if period == "week":
        return now - timedelta(days=7)
    if period == "month":
        return now - timedelta(days=30)
    return None


async def _user_points_map(
    session: AsyncSession, period: RankPeriod
) -> dict[UUID, int]:
    stmt = (
        select(
            TaskProgressRow.user_id,
            func.coalesce(func.sum(TaskDefRow.points), 0).label("pts"),
        )
        .join(TaskDefRow, TaskDefRow.id == TaskProgressRow.task_def_id)
        .where(TaskProgressRow.status == "completed")
        .group_by(TaskProgressRow.user_id)
    )
    since = _since(period)
    if since is not None:
        stmt = stmt.where(TaskProgressRow.completed_at >= since)
    rows = (await session.execute(stmt)).all()
    return {uid: int(pts) for uid, pts in rows}


def _slice_after_cursor(
    sorted_entries: list[tuple[int, UUID]],
    cursor: str | None,
    limit: int,
) -> tuple[list[tuple[int, UUID]], int, str | None]:
    """Slice ``sorted_entries`` (points desc, id asc) starting strictly
    after the cursor. Returns ``(page, start_idx, next_cursor)``.

    The cursor is opaque base64(JSON of ``{pts, id}``). A row is "after
    the cursor" iff ``pts < cursor_pts`` OR
    ``pts == cursor_pts AND str(id) > str(cursor_id)``.
    """
    from backend.services.pagination import InvalidCursor

    start_idx = 0
    if cursor is not None:
        payload = decode_cursor(cursor)
        try:
            cursor_pts = int(payload["pts"])
            cursor_id_str = str(payload["id"])
        except (KeyError, TypeError, ValueError) as exc:
            raise InvalidCursor(
                f"rank cursor missing/invalid pts/id: {exc}"
            ) from exc
        for idx, (pts, eid) in enumerate(sorted_entries):
            if pts < cursor_pts or (pts == cursor_pts and str(eid) > cursor_id_str):
                start_idx = idx
                break
        else:
            start_idx = len(sorted_entries)

    page = sorted_entries[start_idx : start_idx + limit]
    next_cursor: str | None = None
    if start_idx + limit < len(sorted_entries) and page:
        last_pts, last_id = page[-1]
        next_cursor = encode_cursor({"pts": int(last_pts), "id": str(last_id)})
    return page, start_idx, next_cursor


async def leaderboard_users(
    session: AsyncSession, *, period: RankPeriod, cursor: str | None, limit: int
) -> Paginated[UserRankEntry]:
    window_pts = await _user_points_map(session, period)
    week_pts = window_pts if period == "week" else await _user_points_map(session, "week")

    users = {
        u.id: u
        for u in (await session.execute(select(UserRow))).scalars().all()
    }
    # Full ranking (pts desc, id asc). Users with no completions still
    # appear at points=0 so the leaderboard covers the full roster.
    all_entries: list[tuple[int, UUID]] = sorted(
        ((window_pts.get(uid, 0), uid) for uid in users),
        key=lambda kv: (-kv[0], str(kv[1])),
    )
    page, start_idx, next_cursor = _slice_after_cursor(all_entries, cursor, limit)

    items: list[UserRankEntry] = []
    for offset, (pts, uid) in enumerate(page):
        u = users[uid]
        name = u.zh_name or u.nickname or u.email.split("@", 1)[0]
        items.append(
            UserRankEntry(
                user=UserRef(
                    id=u.id,
                    display_id=u.display_id,
                    name=name,
                    avatar_url=u.avatar_url,
                ),
                rank=start_idx + offset + 1,
                points=pts,
                week_points=week_pts.get(uid, 0),
            )
        )
    return Paginated[UserRankEntry](items=items, next_cursor=next_cursor)


async def leaderboard_teams(
    session: AsyncSession, *, period: RankPeriod, cursor: str | None, limit: int
) -> Paginated[TeamRankEntry]:
    window_pts_by_user = await _user_points_map(session, period)
    week_pts_by_user = (
        window_pts_by_user if period == "week" else await _user_points_map(session, "week")
    )

    teams = (await session.execute(select(TeamRow))).scalars().all()
    if not teams:
        return Paginated[TeamRankEntry](items=[], next_cursor=None)

    team_member_ids: dict[UUID, list[UUID]] = {}
    for team in teams:
        mems = (
            await session.execute(
                select(TeamMembershipRow.user_id).where(
                    TeamMembershipRow.team_id == team.id
                )
            )
        ).all()
        team_member_ids[team.id] = [team.leader_id] + [m[0] for m in mems]

    totals: dict[UUID, int] = {
        tid: sum(window_pts_by_user.get(uid, 0) for uid in uids)
        for tid, uids in team_member_ids.items()
    }
    week_totals: dict[UUID, int] = {
        tid: sum(week_pts_by_user.get(uid, 0) for uid in uids)
        for tid, uids in team_member_ids.items()
    }

    all_entries: list[tuple[int, UUID]] = sorted(
        ((pts, tid) for tid, pts in totals.items()),
        key=lambda kv: (-kv[0], str(kv[1])),
    )
    page, start_idx, next_cursor = _slice_after_cursor(all_entries, cursor, limit)

    team_by_id = {t.id: t for t in teams}
    leaders = {
        u.id: u
        for u in (
            await session.execute(
                select(UserRow).where(
                    UserRow.id.in_([t.leader_id for t in teams])
                )
            )
        ).scalars().all()
    }

    items: list[TeamRankEntry] = []
    for offset, (pts, tid) in enumerate(page):
        t = team_by_id[tid]
        leader = leaders[t.leader_id]
        leader_name = leader.zh_name or leader.nickname or leader.email.split("@", 1)[0]
        items.append(
            TeamRankEntry(
                team=TeamRef(
                    id=t.id,
                    display_id=t.display_id,
                    name=t.name,
                    topic=t.topic,
                    leader=UserRef(
                        id=leader.id,
                        display_id=leader.display_id,
                        name=leader_name,
                        avatar_url=leader.avatar_url,
                    ),
                ),
                rank=start_idx + offset + 1,
                points=pts,
                week_points=week_totals.get(tid, 0),
            )
        )
    return Paginated[TeamRankEntry](items=items, next_cursor=next_cursor)
```

- [ ] **Step 3: Create `routers/rank.py`**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.contract import Paginated, RankPeriod, TeamRankEntry, UserRankEntry
from backend.db.models import UserRow
from backend.db.session import get_session
from backend.services.rank import leaderboard_teams, leaderboard_users

router = APIRouter(prefix="/rank", tags=["rank"])


@router.get("/users", response_model=Paginated[UserRankEntry])
async def rank_users(
    period: RankPeriod = "week",
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    _: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Paginated[UserRankEntry]:
    return await leaderboard_users(session, period=period, cursor=cursor, limit=limit)


@router.get("/teams", response_model=Paginated[TeamRankEntry])
async def rank_teams(
    period: RankPeriod = "week",
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    _: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Paginated[TeamRankEntry]:
    return await leaderboard_teams(session, period=period, cursor=cursor, limit=limit)
```

- [ ] **Step 4: Mount in `server.py`**

```python
from backend.routers import auth, health, me, rank, tasks, teams

# in create_app():
app.include_router(rank.router, prefix=API_V1)
```

- [ ] **Step 5: Run tests**

```bash
(cd backend && uv run pytest tests/test_rank.py -v)
```

Expected: 7 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/backend/services/rank.py backend/src/backend/routers/rank.py backend/src/backend/server.py backend/tests/test_rank.py
git commit -m "$(cat <<'EOF'
phase5: add GET /rank/users and GET /rank/teams

Points derive dynamically from completed TaskProgressRow sums scoped
to the period window (week=7d / month=30d / all_time). `next_cursor`
encodes the last-returned entry's (points, id) tuple; the next page
filters strictly after it — stable under concurrent writes, matching
spec §5's cursor-pagination intent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task G2: `services/news.py` + GET /news (cursor-paginated)

**Files:**
- Create: `backend/src/backend/services/news.py`
- Create: `backend/src/backend/routers/news.py`
- Modify: `backend/src/backend/server.py` (mount)
- Create: `backend/tests/test_news.py`

- [ ] **Step 1: Write `tests/test_news.py`**

```python
from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import NewsItemRow
from tests.helpers import sign_in, sign_in_and_complete


async def _seed(session: AsyncSession) -> list[NewsItemRow]:
    items = [
        NewsItemRow(
            title="A-pin",
            body="...",
            category="公告",
            pinned=True,
            published_at=datetime(2026, 4, 18, tzinfo=timezone.utc),
        ),
        NewsItemRow(
            title="B",
            body="...",
            category="活動",
            pinned=False,
            published_at=datetime(2026, 4, 17, tzinfo=timezone.utc),
        ),
        NewsItemRow(
            title="C",
            body="...",
            category="通知",
            pinned=False,
            published_at=datetime(2026, 4, 16, tzinfo=timezone.utc),
        ),
    ]
    for item in items:
        session.add(item)
    await session.commit()
    return items


async def test_news_pinned_first(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _seed(session)
    h = await sign_in(client, "jet@example.com")
    response = await client.get("/api/v1/news", headers=h)
    assert response.status_code == 200
    items = response.json()["items"]
    assert items[0]["title"] == "A-pin"
    assert items[0]["pinned"] is True
    assert [it["title"] for it in items[1:3]] == ["B", "C"]


async def test_news_cursor_pagination(
    client: AsyncClient, session: AsyncSession
) -> None:
    await _seed(session)
    h = await sign_in(client, "jet@example.com")
    first = await client.get("/api/v1/news?limit=2", headers=h)
    data = first.json()
    assert len(data["items"]) == 2
    assert data["next_cursor"] is not None

    second = await client.get(
        f"/api/v1/news?limit=2&cursor={data['next_cursor']}", headers=h
    )
    assert second.status_code == 200
    tail = second.json()["items"]
    assert [it["title"] for it in tail] == ["C"]


async def test_news_over_max_limit_422(client: AsyncClient) -> None:
    h = await sign_in(client, "jet@example.com")
    response = await client.get("/api/v1/news?limit=101", headers=h)
    assert response.status_code == 422


async def test_news_garbage_cursor_returns_400(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.get("/api/v1/news?cursor=not-a-real-cursor", headers=jet.headers)
    assert r.status_code == 400


async def test_news_empty_returns_empty_items(client: AsyncClient) -> None:
    """Empty news table: 200 with items=[] and next_cursor=null."""
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.get("/api/v1/news", headers=jet.headers)
    assert r.status_code == 200
    data = r.json()
    assert data["items"] == []
    assert data["next_cursor"] is None


async def test_news_cursor_terminal_page_next_cursor_is_none(
    client: AsyncClient, session: AsyncSession
) -> None:
    """On the last page, next_cursor must be null."""
    from backend.db.models import NewsItemRow
    from datetime import datetime, timezone

    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    for i in range(3):
        session.add(NewsItemRow(
            title=f"News {i}",
            body=f"body {i}",
            pinned=False,
            category="events",
            published_at=datetime(2026, 4, 10 + i, tzinfo=timezone.utc),
        ))
    await session.commit()

    first = (await client.get("/api/v1/news?limit=2", headers=jet.headers)).json()
    assert len(first["items"]) == 2
    assert first["next_cursor"] is not None

    second = (await client.get(
        f"/api/v1/news?limit=2&cursor={first['next_cursor']}", headers=jet.headers
    )).json()
    assert len(second["items"]) == 1
    assert second["next_cursor"] is None
```

- [ ] **Step 2: Write `services/news.py`**

```python
"""News feed. pinned first, then by published_at desc, then id desc.

Keyset pagination is delegated to ``services.pagination.paginate_keyset``
— it composes a ``tuple_(...) < tuple_(...)`` WHERE from the declared
``sort`` spec, so the filter and the cursor encoding can't drift apart.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import NewsItem as ContractNewsItem
from backend.contract import Paginated
from backend.db.models import NewsItemRow
from backend.services.pagination import SortCol, paginate_keyset


def _row_to_contract(row: NewsItemRow) -> ContractNewsItem:
    return ContractNewsItem(
        id=row.id,
        title=row.title,
        body=row.body,
        category=row.category,  # type: ignore[arg-type]
        image_url=row.image_url,
        published_at=row.published_at,
        pinned=row.pinned,
    )


async def list_news(
    session: AsyncSession, *, cursor: str | None, limit: int
) -> Paginated[ContractNewsItem]:
    stmt = select(NewsItemRow)
    page, next_cursor = await paginate_keyset(
        session,
        stmt,
        sort=[
            SortCol(NewsItemRow.pinned, to_json=bool, from_json=bool),
            SortCol(
                NewsItemRow.published_at,
                to_json=lambda d: d.isoformat(),
                from_json=datetime.fromisoformat,
            ),
            SortCol(NewsItemRow.id, to_json=str, from_json=UUID),
        ],
        cursor=cursor,
        limit=limit,
        extract=lambda r: (r[0].pinned, r[0].published_at, r[0].id),
    )
    return Paginated[ContractNewsItem](
        items=[_row_to_contract(r[0]) for r in page],
        next_cursor=next_cursor,
    )
```

Note: `paginate_keyset` applies ORDER BY `pinned DESC, published_at DESC, id DESC` and, when a cursor is present, the WHERE `tuple_(pinned, published_at, id) < tuple_(cursor_values)` — strict "after the cursor" under the DESC ordering. The encoder and filter share one `sort` spec so they can't drift.

- [ ] **Step 3: Write `routers/news.py`**

```python
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
```

- [ ] **Step 4: Mount in `server.py`**

```python
from backend.routers import auth, health, me, news, rank, tasks, teams

app.include_router(news.router, prefix=API_V1)
```

- [ ] **Step 5: Run tests**

```bash
(cd backend && uv run pytest tests/test_news.py -v)
```

Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/backend/services/news.py backend/src/backend/routers/news.py backend/src/backend/server.py backend/tests/test_news.py
git commit -m "$(cat <<'EOF'
phase5: add GET /news with cursor pagination

Order pinned DESC, published_at DESC, id DESC. Cursor is base64(JSON)
of the last row's (pinned, published_at, id) — Postgres tuple
comparison drives the 'strictly after' predicate cleanly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist

**Spec coverage — endpoints shipped by this plan:**

| Endpoint | Task |
|---|---|
| `GET /me/tasks` | F3 |
| `GET /me/rewards` | F5 |
| `GET /tasks/{task_id}` | F3 |
| `POST /tasks/{task_id}/submit` | F4 |
| `GET /rank/users` | G1 |
| `GET /rank/teams` | G1 |
| `GET /news` | G2 |

**Placeholder scan:** No `TBD` / `implement later` / "similar to task N" / "add error handling" / "write tests for the above" placeholders remain. Every code step ships complete, runnable code.

**Type consistency:**
- Mapping-helper keyword convention: `row_to_contract_task(session, task_def, *, caller: UserRow)` (F2) accepts the full row — the task mapper uses additional user fields internally.
- `TaskSubmitError(status_code, detail)` is the single exception raised from `services/task.submit_task`; the router translates `status_code` 1:1 (400/409/412).

**Known gaps surfaced during plan writing (documented, not blocking):**

- `Reward.status == "claimed"` has no endpoint to transition into it yet — the frontend has no claim flow in the prototype. Leaving the column in place for Phase 6+ to consume.
- Period-filter branch coverage: week/all_time covered; `month` is covered transitively by the `_since()` helper but has no dedicated test — acceptable.
- Cursor-shape drift across endpoints (rank uses dict; news uses list) is now explicitly rejected via `InvalidCursor` on shape mismatch.
- Reward user-scope isolation is covered by `test_me_rewards_is_scoped_to_caller`.

**Resolved during review (previously flagged as gaps):**

- ✅ **Rank pagination is a real cursor, not an offset.** `services/rank.py` encodes each entry's `(points, id)` tuple as the cursor and filters the next page with strict tuple-after comparison, matching spec §5. Stable under concurrent writes.
- ✅ **News cursor parses UUID eagerly.** `services/news.py` calls `UUID(payload["id"])` before building the tuple predicate, so a malformed cursor fails fast with a clean `ValueError` instead of relying on psycopg's wire-level str coercion.
- ✅ **Keyset pagination is a shared helper, not inline.** `services/pagination.py` (from 5c) exposes `paginate_keyset(session, stmt, *, sort, cursor, limit, extract)` plus a `SortCol` dataclass; `list_news` calls through it. `leaderboard_users` / `leaderboard_teams` keep their Python-side sort for Phase 5 with a `TODO(phase-6)` pointing at the window-function rewrite.
- ✅ **Malformed cursor is a clean 400.** `decode_cursor` raises `InvalidCursor` (a `ValueError` subclass); `create_app()` (from 5c) registers one global handler that translates it to HTTP 400 so `?cursor=garbage` no longer surfaces as 500 on any paginated endpoint.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-19-phase-5d-content.md`.**

The plan lives in the main repo so it's visible across worktrees. Before executing, create a worktree under `.worktree/phase-5d-content` (per user's global instruction) so Phase-5d work stays isolated.

Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task with a two-stage review between them. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks sequentially in the current session with batch checkpoints. Use `superpowers:executing-plans`. Faster wall-clock, but the main session's context fills up quickly.

**After 5d merges, proceed to phase-5e-polish.**

**Which approach would you like?**
