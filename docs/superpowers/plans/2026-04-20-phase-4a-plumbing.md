# Phase 4a — Plumbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land all infrastructure for Phase 4 — TanStack Query, MSW, generated OpenAPI types, hand-rolled `apiFetch`, per-resource API modules, query/mutation factories, `UIStateProvider`, `AuthProvider` scaffolding, plus the backend seed expansion (demo users + γ-with-two-leaders join-request fan-out + `just seed-reset` + `just gen-demo-accounts`). After this PR every Phase-4 module exists and is unit-tested in isolation, but `AppStateContext` continues to back every existing screen — no UI changes, every existing test still passes.

**Prereqs:** phase-5e merged. The spec assumes Phase 5 is complete.

**Architecture:** Two parallel tracks. Backend track adds idempotent demo-user seed via `services.user`/`services.team.create_led_team` and a small CLI dump script that emits a JSON file the frontend checks in. Frontend track adds the `api/` + `queries/` + `mutations/` + `auth/` + `ui/` + `test/msw/` modules described in spec §3.1 — every module compiles, has a unit test, and is wired through `apiFetch` against MSW handlers. Nothing in this PR replaces an `useAppState()` callsite.

**Tech Stack:**
- Frontend additions: `@tanstack/react-query@^5`, `@tanstack/react-query-devtools@^5`, `msw@^2`, `openapi-typescript@^7` (dev). Existing: React 18, Vite 6, TanStack Router, Vitest 4, Testing Library, jsdom.
- Backend additions: none. Re-uses existing FastAPI / SQLModel / pytest harness.

**Spec:** `docs/superpowers/specs/2026-04-20-phase-4-frontend-wiring-design.md`. Sections used in this plan: §3.1 module layout; §3.2 UIStateProvider scope; §3.4 cross-cutting (registrar pattern); §4.2 token storage; §4.4 401 interceptor body (handler-only this PR); §5 data layer (apiFetch, gen-types, query keys, queryOptions factories, pagination); §6 mutations (default invalidate map); §7 backend seed; §8 test infrastructure.

**Exit criteria:**

- `pnpm -C frontend test` green; the existing `AppStateContext`-backed test suite is unchanged
- `pnpm -C frontend build` succeeds (typecheck + Vite build)
- `just -f backend/justfile ci` green; new tests for the demo-user seed + display_id validator drift guard pass
- `just gen-types` produces a valid `frontend/src/api/schema.d.ts` from the in-process FastAPI app (no running server, no DB)
- `just gen-demo-accounts` writes `frontend/src/dev/demo-accounts.json` matching the seeded `DEMO_USERS`
- `just -f backend/justfile seed-reset && just -f backend/justfile seed` is idempotent (running twice produces zero new rows the second time, no IntegrityError)
- `grep -rn 'useAppState' frontend/src/` count is **unchanged from main** (this PR adds zero callsites and removes zero)

---

## Scoping decisions locked before drafting

| Decision | Choice | Why |
|---|---|---|
| Frontend package manager | `pnpm` (already in use) | Established. |
| TanStack Query version | `^5` | Current major. Spec assumes `queryOptions`, `useSuspenseQuery`, `useInfiniteQuery` from v5. |
| MSW version | `^2` | v2's `http.get` / `HttpResponse` API is what spec §8 references. |
| `openapi-typescript` invocation | Repo-root `just gen-types` recipe; runs Python in-process to dump OpenAPI to `/tmp`, then `pnpm -C frontend dlx openapi-typescript /tmp/...` | Spec §5.1 explicit. Avoids a running server. |
| Demo seed leader teams | Created via `services.team.create_led_team` (the same code path real users hit) | Avoids duplicating logic; respects all invariants. |
| Demo join-request creation | Via `services.team.create_join_request` (same code path) | Same reasoning. |
| `gen-demo-accounts` script location | `backend/src/backend/scripts/dump_demo_accounts.py` | New `scripts/` dir; stays inside the package so `python -m backend.scripts.dump_demo_accounts` works. |
| Demo email domain | `@demo.gal` | Distinct from real Google accounts; obvious in logs. |
| Demo display IDs | Server-assigned via existing `services.display_id` (no hand-coding) | Avoids the Phase 5e "seed bypasses display_id" debt item entirely. |
| `gen-types` placement | Repo-root justfile (NOT backend's) | Cross-stack recipe; stays out of `backend/justfile` which is Python-only. |
| Repo-root justfile existence | Create one if missing; it's the right home for cross-stack recipes | Phase 5 had `backend/justfile` only; Phase 4 needs cross-stack. |
| MSW transport | `msw/node` (Vitest runs in jsdom; MSW uses Node interceptor) | Standard for jsdom test envs. |
| `tokenStore` test reset | `afterEach` in `setup.ts` calls `tokenStore.clear()` | Prevents cross-test localStorage bleed. |
| Vite proxy | `/api/*` → `http://localhost:8000` (no rewrite — backend already serves at `/api/v1/`) | Spec §5.2. |

---

## File plan

Files created (C) or modified (M) by this plan. Paths are relative to repo root `/Users/Jet/Developer/golden-abundance-lite`.

### Repo root

| Path | Action | Contents |
|---|---|---|
| `justfile` | C | Cross-stack recipes: `gen-types`, `gen-demo-accounts`, `dev` (boots backend + frontend in parallel) |
| `.gitignore` | M | Add `frontend/src/api/schema.d.ts` |

### Backend

| Path | Action | Contents |
|---|---|---|
| `backend/src/backend/seed.py` | M | Add `DEMO_USERS` constant, `_upsert_demo_users()`, `_upsert_demo_join_requests()`, extend `run()` |
| `backend/src/backend/scripts/__init__.py` | C | (empty) |
| `backend/src/backend/scripts/dump_demo_accounts.py` | C | CLI that imports `DEMO_USERS`, prints JSON to stdout |
| `backend/justfile` | M | Add `seed-reset` recipe (gated on `APP_ENV != "prod"`) |
| `backend/tests/test_seed_demo.py` | C | Demo seed is idempotent; fan-out matches spec §7.1; respects at-most-one-pending invariant |
| `backend/tests/test_seed_display_id_drift.py` | C | Validator drift guard: every seeded `display_id` re-passes `services.display_id` validator |

### Frontend — package + build config

| Path | Action | Contents |
|---|---|---|
| `frontend/package.json` | M | Add deps: `@tanstack/react-query@^5`, `@tanstack/react-query-devtools@^5`. Add devDeps: `msw@^2`, `openapi-typescript@^7` |
| `frontend/vite.config.ts` | M | Add `server.proxy: { "/api": "http://localhost:8000" }` |
| `frontend/tsconfig.json` | M | Ensure `src/api/schema.d.ts` is in `include` (gitignored but present) |

### Frontend — `src/api/`

| Path | Action | Contents |
|---|---|---|
| `frontend/src/api/schema.d.ts` | C (generated) | OpenAPI-derived types. Gitignored. |
| `frontend/src/api/errors.ts` | C | `ApiError` class (status + detail) |
| `frontend/src/api/client.ts` | C | `apiFetch<T>`; `setSessionExpiredHandler` registrar; bearer injection; 401 / non-2xx / 204 handling |
| `frontend/src/api/auth.ts` | C | `postGoogleAuth`, `postLogout` |
| `frontend/src/api/me.ts` | C | `getMe`, `getMyTasks`, `getMyTeams`, `getMyRewards`, `postProfile`, `patchMe` |
| `frontend/src/api/tasks.ts` | C | `getTask`, `submitTask` |
| `frontend/src/api/teams.ts` | C | `listTeams`, `getTeam`, `patchTeam`, `createJoinRequest`, `cancelJoinRequest`, `approveJoinRequest`, `rejectJoinRequest`, `leaveTeam` |
| `frontend/src/api/rank.ts` | C | `listUserRank`, `listTeamRank` |
| `frontend/src/api/news.ts` | C | `listNews` |
| `frontend/src/api/index.ts` | C | Namespace re-export: `export * as auth from './auth'`, etc. |

### Frontend — `src/queries/`

| Path | Action | Contents |
|---|---|---|
| `frontend/src/queries/keys.ts` | C | `qk` factory + `TeamSearchParams` type |
| `frontend/src/queries/me.ts` | C | `meQueryOptions`, `myTasksQueryOptions`, `myTeamsQueryOptions`, `myRewardsQueryOptions` |
| `frontend/src/queries/tasks.ts` | C | `taskQueryOptions(uuid)` |
| `frontend/src/queries/teams.ts` | C | `teamsInfiniteQueryOptions(params)`, `teamQueryOptions(uuid)` |
| `frontend/src/queries/rank.ts` | C | `rankUsersInfiniteQueryOptions(period)`, `rankTeamsInfiniteQueryOptions(period)` |
| `frontend/src/queries/news.ts` | C | `newsInfiniteQueryOptions()` |

### Frontend — `src/mutations/`

| Path | Action | Contents |
|---|---|---|
| `frontend/src/mutations/me.ts` | C | `useCompleteProfile`, `usePatchMe` (default invalidate; no optimistic) |
| `frontend/src/mutations/tasks.ts` | C | `useSubmitTask` (default invalidate) |
| `frontend/src/mutations/teams.ts` | C | `useCreateJoinRequest`, `useCancelJoinRequest`, `useApproveJoinRequest`, `useRejectJoinRequest`, `useLeaveTeam`, `usePatchTeam` (default invalidate; optimistic added in 4c) |

### Frontend — `src/auth/`, `src/ui/`, `src/dev/`

| Path | Action | Contents |
|---|---|---|
| `frontend/src/auth/token.ts` | C | `tokenStore` (localStorage under `gal.token`) |
| `frontend/src/auth/session.ts` | C | `AuthProvider`, `useAuth`, module-level `signOut`, registers `setSessionExpiredHandler` at import |
| `frontend/src/ui/toasts.ts` | C | `Toast` type, `setToastSink`, `pushToast` |
| `frontend/src/ui/UIStateProvider.tsx` | C | Provider with `successData` + `toasts`; on mount registers toast sink |
| `frontend/src/ui/useUIState.ts` | C | `useUIState()` hook, `pushSuccess` re-export |
| `frontend/src/dev/demo-accounts.json` | C (generated, checked in) | `[{email, label}]` from `DEMO_USERS` |
| `frontend/src/dev/demo-accounts.ts` | C | Typed import wrapper around the JSON |

### Frontend — tests + MSW

| Path | Action | Contents |
|---|---|---|
| `frontend/src/test/setup.ts` | M | Start MSW server, reset handlers + `tokenStore` + `queryClient` after each test |
| `frontend/src/test/msw/server.ts` | C | `setupServer(...defaultHandlers)` |
| `frontend/src/test/msw/fixtures.ts` | C | Canonical `User`, `Team`, `Task[]`, `Reward[]`, `NewsItem[]`, `Paginated<*>` |
| `frontend/src/test/msw/handlers.ts` | C | Default success handlers for every endpoint |
| `frontend/src/api/__tests__/client.test.ts` | C | bearer injection, 401 dispatch, non-2xx → ApiError, 204 → undefined |
| `frontend/src/auth/__tests__/token.test.ts` | C | `tokenStore` round-trip |
| `frontend/src/auth/__tests__/session.test.tsx` | C | `signIn` writes token + seeds `qk.me`; `signOut` clears + navigates |
| `frontend/src/ui/__tests__/UIStateProvider.test.tsx` | C | Provider mount registers toast sink; `pushSuccess` updates `successData` |
| `frontend/src/queries/__tests__/keys.test.ts` | C | Key factory shape regressions |
| `frontend/src/mutations/__tests__/me.test.ts` | C | `useCompleteProfile` invalidates `qk.me`, `qk.myTeams`, `qk.myTasks` (table-driven across all default-invalidate mutations) |

---

## Section A — Backend seed expansion

**Exit criteria:** `just -f backend/justfile seed && just -f backend/justfile seed` (twice in a row) yields the same row count the second time. `just -f backend/justfile test` runs the new `test_seed_demo.py` and `test_seed_display_id_drift.py` green. `just -f backend/justfile seed-reset` truncates seed-owned tables and re-seeds.

### Task A1: Add `DEMO_USERS` constant + idempotent demo-user upsert

**Files:**
- Modify: `backend/src/backend/seed.py`
- Create: `backend/tests/test_seed_demo.py`

- [ ] **Step 1: Write the failing test for demo-user upsert**

Create `backend/tests/test_seed_demo.py`:

```python
"""Phase 4a demo seed — exercises DEMO_USERS upsert, the
γ-with-two-leaders join-request fan-out, and the at-most-one-pending
invariant.

Each test uses the existing testcontainer harness from conftest. The
seed coroutine is invoked directly (not via subprocess) so failures
surface as plain assertion errors.
"""

from __future__ import annotations

from sqlalchemy import select

from backend.db.models import (
    JoinRequestRow,
    TeamMembershipRow,
    TeamRow,
    UserRow,
)
from backend.seed import DEMO_USERS, run as run_seed


async def test_demo_users_seeded(session_factory) -> None:
    async with session_factory() as session:
        await run_seed_for_test(session)

    async with session_factory() as session:
        rows = (await session.execute(select(UserRow))).scalars().all()
    emails = {u.email for u in rows}
    assert emails >= {u["email"] for u in DEMO_USERS}
    for u in rows:
        if u.email.endswith("@demo.gal"):
            assert u.profile_complete is True, f"{u.email} should be profile-complete"
            assert u.zh_name, f"{u.email} should have zh_name set"
            assert u.display_id.startswith("U"), f"{u.email} display_id shape"


async def test_demo_users_idempotent(session_factory) -> None:
    async with session_factory() as session:
        await run_seed_for_test(session)
        first_count = await _count(session, UserRow)
    async with session_factory() as session:
        await run_seed_for_test(session)
        second_count = await _count(session, UserRow)
    assert first_count == second_count, "second run must add zero users"


async def _count(session, model) -> int:
    rows = (await session.execute(select(model))).scalars().all()
    return len(rows)


async def run_seed_for_test(session) -> None:
    """Wrapper that runs `backend.seed.run` against the test container's
    engine. The pytest harness already binds DATABASE_URL to the
    container, so calling `run()` is correct."""
    await run_seed()
```

- [ ] **Step 2: Verify the harness fixture name**

Run: `grep -n session_factory backend/tests/conftest.py`

Expected: a fixture named `session_factory` (or equivalent) exists. If the project's fixture is named differently (`session_maker`, `db`, etc.), rename in the test file before proceeding. The Phase 5a plan introduced this fixture; check `backend/tests/conftest.py` for the exact name.

- [ ] **Step 3: Run the test to verify it fails**

```
just -f backend/justfile test backend/tests/test_seed_demo.py -v
```

Expected: ImportError on `DEMO_USERS` (not yet defined in `seed.py`).

- [ ] **Step 4: Add `DEMO_USERS` constant + `_upsert_demo_users` to `seed.py`**

Edit `backend/src/backend/seed.py`. After the existing imports, add:

```python
from backend.contract import ProfileCreate
from backend.services import user as user_service
```

After `_upsert_news`, add:

```python
DEMO_USERS: list[dict[str, str]] = [
    {
        "email": "jet@demo.gal",
        "zh_name": "金杰",
        "en_name": "Jet Kan",
        "nickname": "Jet",
        "phone": "912345678",
        "phone_code": "+886",
        "country": "TW",
        "location": "台北",
    },
    {
        "email": "ami@demo.gal",
        "zh_name": "林詠瑜",
        "en_name": "Ami Lin",
        "nickname": "Ami",
        "phone": "912345679",
        "phone_code": "+886",
        "country": "TW",
        "location": "台北",
    },
    {
        "email": "alex@demo.gal",
        "zh_name": "陳志豪",
        "en_name": "Alex Chen",
        "nickname": "Alex",
        "phone": "912345680",
        "phone_code": "+886",
        "country": "TW",
        "location": "新北",
    },
    {
        "email": "mei@demo.gal",
        "zh_name": "王美玲",
        "en_name": "Mei Wang",
        "nickname": "Mei",
        "phone": "912345681",
        "phone_code": "+886",
        "country": "TW",
        "location": "台中",
    },
    {
        "email": "kai@demo.gal",
        "zh_name": "黃凱文",
        "en_name": "Kai Huang",
        "nickname": "Kai",
        "phone": "912345682",
        "phone_code": "+886",
        "country": "TW",
        "location": "高雄",
    },
    {
        "email": "yu@demo.gal",
        "zh_name": "張詩宇",
        "en_name": "Yu Chang",
        "nickname": "Yu",
        "phone": "912345683",
        "phone_code": "+886",
        "country": "TW",
        "location": "台南",
    },
]


async def _upsert_demo_users(session: AsyncSession) -> dict[str, UserRow]:
    """Upsert DEMO_USERS. For each missing email, run the same
    sign-in-then-complete-profile flow real users go through, so the
    led team gets created via services.team.create_led_team and the
    display_id assignment runs through services.display_id."""
    existing = {
        u.email: u
        for u in (await session.execute(select(UserRow))).scalars().all()
        if u.email.endswith("@demo.gal")
    }
    out: dict[str, UserRow] = dict(existing)
    for spec in DEMO_USERS:
        if spec["email"] in existing:
            continue
        user = await user_service.get_or_create_by_email(session, spec["email"])
        await user_service.complete_profile(
            session,
            user,
            ProfileCreate(
                zh_name=spec["zh_name"],
                en_name=spec.get("en_name"),
                nickname=spec.get("nickname"),
                phone=spec["phone"],
                phone_code=spec["phone_code"],
                line_id=spec.get("line_id"),
                telegram_id=spec.get("telegram_id"),
                country=spec["country"],
                location=spec["location"],
            ),
        )
        out[spec["email"]] = user
    await session.flush()
    return out
```

- [ ] **Step 5: Wire `_upsert_demo_users` into `run()`**

In `backend/src/backend/seed.py`, modify `run()`:

```python
async def run() -> None:
    async with get_session_maker()() as session:
        await _upsert_task_defs(session)
        await _upsert_news(session)
        await _upsert_demo_users(session)
        await session.commit()
    print("seed: done")
```

- [ ] **Step 6: Verify the user-service entrypoints exist**

```
grep -n 'def get_or_create_by_email\|def complete_profile' backend/src/backend/services/user.py
```

Expected: both functions exist (Phase 5b/5c added them). If `get_or_create_by_email` is named differently (e.g. `upsert_by_email`, `find_or_create`), update Step 4's references and continue. If `complete_profile` doesn't take a `ProfileCreate` directly, adapt to its actual signature — re-read the function and call it with the equivalent fields.

- [ ] **Step 7: Run the test**

```
just -f backend/justfile test backend/tests/test_seed_demo.py::test_demo_users_seeded backend/tests/test_seed_demo.py::test_demo_users_idempotent -v
```

Expected: both PASS. If a unique-constraint error fires, that means an idempotency check is wrong — fix the `if spec["email"] in existing` guard.

- [ ] **Step 8: Commit**

```bash
git add backend/src/backend/seed.py backend/tests/test_seed_demo.py
git commit -m "feat(backend): seed DEMO_USERS via real signup flow"
```

### Task A2: Demo join-request fan-out (γ-with-two-leaders)

**Files:**
- Modify: `backend/src/backend/seed.py`
- Modify: `backend/tests/test_seed_demo.py`

- [ ] **Step 1: Append the fan-out test cases**

Append to `backend/tests/test_seed_demo.py`:

```python
DEMO_FANOUT_EXPECTED = {
    # requester_email -> leader_email
    "alex@demo.gal": "jet@demo.gal",
    "mei@demo.gal": "jet@demo.gal",
    "kai@demo.gal": "ami@demo.gal",
    "yu@demo.gal": "ami@demo.gal",
}


async def test_demo_join_requests_fanout(session_factory) -> None:
    async with session_factory() as session:
        await run_seed_for_test(session)

    async with session_factory() as session:
        users = {
            u.email: u
            for u in (await session.execute(select(UserRow))).scalars().all()
        }
        teams = {
            t.leader_id: t for t in (await session.execute(select(TeamRow))).scalars().all()
        }
        reqs = (
            await session.execute(
                select(JoinRequestRow).where(JoinRequestRow.status == "pending")
            )
        ).scalars().all()

    actual = {users[r.user_id].email: ... for r in reqs}  # placeholder; resolve below
    # Resolve each request's leader email via team -> leader_id
    actual = {}
    for r in reqs:
        team = next(t for t in teams.values() if t.id == r.team_id)
        leader_email = next(u.email for u in users.values() if u.id == team.leader_id)
        requester_email = next(u.email for u in users.values() if u.id == r.user_id)
        if requester_email.endswith("@demo.gal"):
            actual[requester_email] = leader_email

    assert actual == DEMO_FANOUT_EXPECTED, f"fan-out mismatch: {actual}"


async def test_demo_at_most_one_pending_per_user(session_factory) -> None:
    """Phase 5c invariant: a user can have at most one pending request anywhere."""
    async with session_factory() as session:
        await run_seed_for_test(session)
    async with session_factory() as session:
        reqs = (
            await session.execute(
                select(JoinRequestRow).where(JoinRequestRow.status == "pending")
            )
        ).scalars().all()
        per_user: dict = {}
        for r in reqs:
            per_user[r.user_id] = per_user.get(r.user_id, 0) + 1
        for uid, count in per_user.items():
            assert count == 1, f"user {uid} has {count} pending requests"


async def test_demo_join_requests_idempotent(session_factory) -> None:
    async with session_factory() as session:
        await run_seed_for_test(session)
        first = await _count_status(session, "pending")
    async with session_factory() as session:
        await run_seed_for_test(session)
        second = await _count_status(session, "pending")
    assert first == second == 4, f"expected 4 pending rows, got first={first} second={second}"


async def _count_status(session, status: str) -> int:
    rows = (
        await session.execute(
            select(JoinRequestRow).where(JoinRequestRow.status == status)
        )
    ).scalars().all()
    return len(rows)
```

- [ ] **Step 2: Run the new tests; expect failure**

```
just -f backend/justfile test backend/tests/test_seed_demo.py -v
```

Expected: 3 new tests FAIL (no fan-out yet — `actual` is empty / `first == 0`).

- [ ] **Step 3: Add the join-request seed function**

Append to `backend/src/backend/seed.py`:

```python
from backend.db.models import JoinRequestRow, TeamRow
from backend.services import team as team_service

DEMO_FANOUT: list[tuple[str, str]] = [
    # (requester_email, leader_email)
    ("alex@demo.gal", "jet@demo.gal"),
    ("mei@demo.gal", "jet@demo.gal"),
    ("kai@demo.gal", "ami@demo.gal"),
    ("yu@demo.gal", "ami@demo.gal"),
]


async def _upsert_demo_join_requests(
    session: AsyncSession, users: dict[str, UserRow]
) -> None:
    """Create the four seeded pending join-requests. Skip a row when an
    equivalent request already exists OR when the requester already has
    any pending request anywhere (Phase 5c invariant)."""
    teams_by_leader = {
        t.leader_id: t for t in (await session.execute(select(TeamRow))).scalars().all()
    }
    existing_pending_by_user: dict = {}
    for r in (
        await session.execute(
            select(JoinRequestRow).where(JoinRequestRow.status == "pending")
        )
    ).scalars().all():
        existing_pending_by_user.setdefault(r.user_id, []).append(r)

    for requester_email, leader_email in DEMO_FANOUT:
        requester = users.get(requester_email)
        leader = users.get(leader_email)
        if requester is None or leader is None:
            continue
        if existing_pending_by_user.get(requester.id):
            # Already has a pending request — skip (idempotent).
            continue
        team = teams_by_leader.get(leader.id)
        if team is None:
            continue
        await team_service.create_join_request(session, team_id=team.id, user=requester)
    await session.flush()
```

- [ ] **Step 4: Wire it into `run()`**

```python
async def run() -> None:
    async with get_session_maker()() as session:
        await _upsert_task_defs(session)
        await _upsert_news(session)
        users = await _upsert_demo_users(session)
        await _upsert_demo_join_requests(session, users)
        await session.commit()
    print("seed: done")
```

- [ ] **Step 5: Verify the team-service entrypoint signature**

```
grep -n 'def create_join_request' backend/src/backend/services/team.py
```

Expected: a function that takes `(session, team_id, user)` or similar. Adapt the call in Step 3 to the actual signature. If `create_join_request` raises `JoinConflict` on the at-most-one-pending check, the loop's `existing_pending_by_user` guard already prevents that path; if a different conflict surfaces (e.g. caller is leader of own team), wrap in `try / except JoinConflict: continue`.

- [ ] **Step 6: Run all `test_seed_demo.py` tests**

```
just -f backend/justfile test backend/tests/test_seed_demo.py -v
```

Expected: all 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/backend/seed.py backend/tests/test_seed_demo.py
git commit -m "feat(backend): seed γ-with-two-leaders join requests"
```

### Task A3: Display-id validator drift guard

**Files:**
- Create: `backend/tests/test_seed_display_id_drift.py`

- [ ] **Step 1: Write the test**

Create `backend/tests/test_seed_display_id_drift.py`:

```python
"""Phase 5e debt item, addressed in Phase 4a: every display_id emitted
by the seed must round-trip through services.display_id.validate_*. If
the validator tightens, this catches it before the next seed run."""

from __future__ import annotations

import re

from sqlalchemy import select

from backend.db.models import TaskDefRow, TeamRow, UserRow
from backend.seed import run as run_seed


# The contract pins the regexes; see backend/contract/user.py:21,
# backend/contract/team.py:39, backend/contract/task.py (display_id).
USER_DISPLAY_ID_RE = re.compile(r"^U[A-Z0-9]{3,7}$")
TEAM_DISPLAY_ID_RE = re.compile(r"^T-[A-Z0-9]{3,10}$")
TASK_DISPLAY_ID_RE = re.compile(r"^T[0-9A-Z]+$")


async def test_seeded_user_display_ids_round_trip(session_factory) -> None:
    async with session_factory() as session:
        await run_seed()
    async with session_factory() as session:
        for u in (await session.execute(select(UserRow))).scalars().all():
            assert USER_DISPLAY_ID_RE.match(u.display_id), u.display_id


async def test_seeded_team_display_ids_round_trip(session_factory) -> None:
    async with session_factory() as session:
        await run_seed()
    async with session_factory() as session:
        for t in (await session.execute(select(TeamRow))).scalars().all():
            assert TEAM_DISPLAY_ID_RE.match(t.display_id), t.display_id


async def test_seeded_task_display_ids_round_trip(session_factory) -> None:
    async with session_factory() as session:
        await run_seed()
    async with session_factory() as session:
        for t in (await session.execute(select(TaskDefRow))).scalars().all():
            assert TASK_DISPLAY_ID_RE.match(t.display_id), t.display_id
```

- [ ] **Step 2: Run the tests**

```
just -f backend/justfile test backend/tests/test_seed_display_id_drift.py -v
```

Expected: all 3 PASS. If a task display_id (`T1`-`T4`) fails the regex, the contract's pattern is stricter than this test's regex — adjust by reading `backend/contract/task.py` for the actual `display_id` field's `Field(pattern=...)` and copy that regex into this test.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_seed_display_id_drift.py
git commit -m "test(backend): pin seeded display_id shapes"
```

### Task A4: `dump_demo_accounts` script + repo-root justfile

**Files:**
- Create: `backend/src/backend/scripts/__init__.py`
- Create: `backend/src/backend/scripts/dump_demo_accounts.py`
- Create: `justfile` (repo root)

- [ ] **Step 1: Create the script package**

```bash
mkdir -p backend/src/backend/scripts
touch backend/src/backend/scripts/__init__.py
```

- [ ] **Step 2: Write `dump_demo_accounts.py`**

Create `backend/src/backend/scripts/dump_demo_accounts.py`:

```python
"""Dump DEMO_USERS as JSON for the frontend's sign-in picker.

Output shape: [{"email": "...", "label": "金杰 (Jet Kan)"}, ...]

Frontend reads this JSON from `frontend/src/dev/demo-accounts.json`
(checked in; regenerated when DEMO_USERS changes). Single source of
truth lives in seed.py.
"""

from __future__ import annotations

import json
import sys

from backend.seed import DEMO_USERS


def render_label(spec: dict[str, str]) -> str:
    en = spec.get("en_name")
    return f"{spec['zh_name']} ({en})" if en else spec["zh_name"]


def main() -> int:
    payload = [
        {"email": spec["email"], "label": render_label(spec)}
        for spec in DEMO_USERS
    ]
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
```

- [ ] **Step 3: Create the repo-root justfile**

Create `justfile` at the repo root:

```just
# Generate frontend OpenAPI schema types from the FastAPI app (no running server, no DB).
# Output: frontend/src/api/schema.d.ts (gitignored).
gen-types:
    uv run --project backend python -c 'import json; from backend.server import app; print(json.dumps(app.openapi()))' > /tmp/gal-openapi.json
    pnpm -C frontend dlx openapi-typescript /tmp/gal-openapi.json -o src/api/schema.d.ts

# Generate frontend demo-account picker JSON from backend.seed.DEMO_USERS.
# Output: frontend/src/dev/demo-accounts.json (checked in).
gen-demo-accounts:
    uv run --project backend python -m backend.scripts.dump_demo_accounts > frontend/src/dev/demo-accounts.json

# Boot backend and frontend dev servers in parallel (Ctrl-C kills both).
dev:
    just -f backend/justfile dev & \
    pnpm -C frontend dev & \
    wait
```

- [ ] **Step 4: Run `gen-demo-accounts` and verify output**

```
just gen-demo-accounts
cat frontend/src/dev/demo-accounts.json
```

Expected: a 6-element JSON array with the 6 demo emails and labels. If `frontend/src/dev/` doesn't exist yet, the recipe fails on missing directory — create it first:

```bash
mkdir -p frontend/src/dev
just gen-demo-accounts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/scripts justfile frontend/src/dev/demo-accounts.json
git commit -m "feat(backend): dump_demo_accounts script + repo-root justfile"
```

### Task A5: `seed-reset` recipe

**Files:**
- Modify: `backend/justfile`
- Create: `backend/src/backend/seed_reset.py`

- [ ] **Step 1: Write the reset script**

Create `backend/src/backend/seed_reset.py`:

```python
"""Truncate seed-owned tables so the next `just seed` re-creates them.
Refuses to run in production.

Tables truncated (CASCADE handles FK fan-out):
  * task_def, task_def_requires, task_step_def — task definitions
  * news_item — news feed
  * users — every user (cascades to teams, memberships, join_requests, rewards, task_progress)

This is intentionally a hard reset: a partial reset (e.g. only DEMO_USERS)
would leave dangling teams from prior runs and isn't worth the complexity
for a dev-only recipe.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from backend.config import get_settings
from backend.db.engine import get_engine


async def run() -> None:
    settings = get_settings()
    if settings.app_env == "prod":
        raise SystemExit("seed-reset refused: APP_ENV=prod")
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE task_def, news_item, users RESTART IDENTITY CASCADE"
            )
        )
    print("seed-reset: done")


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(run())
```

- [ ] **Step 2: Verify table names**

```
grep -n '__tablename__' backend/src/backend/db/models.py
```

Expected: `__tablename__ = "task_def"`, `"news_item"`, `"users"` exist. If any name differs, edit the TRUNCATE statement to match. (FK CASCADE is what cleans up `team`, `team_membership`, `join_request`, `task_def_requires`, `task_step_def`, `task_progress`, `task_step_progress`, `reward`.)

- [ ] **Step 3: Add the recipe to `backend/justfile`**

Edit `backend/justfile`. After the existing `seed` recipe:

```just
# Truncate seed-owned tables and re-seed. APP_ENV=prod is refused.
seed-reset:
  uv run python -m backend.seed_reset
  uv run python -m backend.seed
```

- [ ] **Step 4: Smoke-test locally**

```
just -f backend/justfile db-up
just -f backend/justfile migrate
just -f backend/justfile seed-reset
just -f backend/justfile seed-reset
```

Expected: both invocations succeed. After the second one, query the user count:

```
docker compose -f backend/docker-compose.yml exec postgres psql -U postgres -d gal -c "select count(*) from users where email like '%@demo.gal';"
```

Expected: `6`.

- [ ] **Step 5: Commit**

```bash
git add backend/justfile backend/src/backend/seed_reset.py
git commit -m "feat(backend): just seed-reset recipe"
```

---

## Section B — Frontend deps + Vite proxy + gitignore

**Exit criteria:** `pnpm -C frontend install` adds the four new deps; `vite.config.ts` proxies `/api/*`; `frontend/src/api/schema.d.ts` is gitignored.

### Task B1: Add deps

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install runtime deps**

```
pnpm -C frontend add @tanstack/react-query@^5 @tanstack/react-query-devtools@^5
```

- [ ] **Step 2: Install dev deps**

```
pnpm -C frontend add -D msw@^2 openapi-typescript@^7
```

- [ ] **Step 3: Verify versions**

```
grep -A1 '"@tanstack/react-query"' frontend/package.json
grep -A1 '"msw"' frontend/package.json
grep -A1 '"openapi-typescript"' frontend/package.json
```

Expected: all four packages present, versions in the `^5` / `^2` / `^7` ranges.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml
git commit -m "chore(frontend): add tanstack-query, msw, openapi-typescript"
```

### Task B2: Vite proxy + gitignore

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Add proxy config**

Edit `frontend/vite.config.ts`:

```ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const allowedHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(",")
        .map((h) => h.trim())
        .filter(Boolean)
    : [];
  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      allowedHosts,
      proxy: {
        "/api": {
          target: env.VITE_API_BASE_URL || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
    preview: { port: 5173 },
  };
});
```

- [ ] **Step 2: Add `schema.d.ts` to gitignore**

Append to `.gitignore`:

```
# Generated by `just gen-types` from the backend's OpenAPI spec.
frontend/src/api/schema.d.ts
```

- [ ] **Step 3: Commit**

```bash
git add frontend/vite.config.ts .gitignore
git commit -m "chore(frontend): proxy /api to backend; gitignore generated schema"
```

---

## Section C — Type generation

**Exit criteria:** `just gen-types` produces `frontend/src/api/schema.d.ts` containing every OpenAPI schema. The file is valid TypeScript and importable.

### Task C1: Run `gen-types` and validate the output

**Files:**
- Generate: `frontend/src/api/schema.d.ts`

- [ ] **Step 1: Ensure the api dir exists**

```bash
mkdir -p frontend/src/api
```

- [ ] **Step 2: Run gen-types**

```
just gen-types
```

Expected: `frontend/src/api/schema.d.ts` is written. If `pnpm dlx openapi-typescript` fails, the most common cause is the FastAPI app not importing cleanly — try `uv run --project backend python -c 'from backend.server import app'` standalone first.

- [ ] **Step 3: Spot-check the output**

```
grep -E 'User|Team|Task|AuthResponse|JoinRequest|Reward|NewsItem' frontend/src/api/schema.d.ts | head -30
```

Expected: each contract model appears as a `components["schemas"][...]` entry with snake_case fields.

- [ ] **Step 4: Verify TypeScript can import the file**

Create a throwaway probe:

```bash
cat > /tmp/schema-probe.ts <<'EOF'
import type { components } from "../frontend/src/api/schema";
type _User = components["schemas"]["User"];
type _Task = components["schemas"]["Task"];
EOF
pnpm -C frontend exec tsc --noEmit /tmp/schema-probe.ts 2>&1 | head
rm /tmp/schema-probe.ts
```

Expected: no errors. If "Cannot find module" — schema.d.ts wasn't generated; re-run Step 2.

- [ ] **No commit yet** — `schema.d.ts` is gitignored. The build artifact lives outside git.

---

## Section D — `apiFetch` + per-resource API modules

**Exit criteria:** `apiFetch` is unit-tested through MSW (bearer header sent, 401 fires the registered handler, 4xx throws `ApiError`, 204 returns `undefined`). Every per-resource module compiles and is one-line wrappers over `apiFetch`.

### Task D1: `ApiError` class

**Files:**
- Create: `frontend/src/api/errors.ts`

- [ ] **Step 1: Write the class**

```ts
// frontend/src/api/errors.ts
export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`[${status}] ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/errors.ts
git commit -m "feat(frontend): ApiError class"
```

### Task D2: MSW infrastructure (needed before `apiFetch` tests)

**Files:**
- Create: `frontend/src/test/msw/server.ts`
- Create: `frontend/src/test/msw/handlers.ts`
- Create: `frontend/src/test/msw/fixtures.ts`
- Modify: `frontend/src/test/setup.ts`

- [ ] **Step 1: Confirm `setup.ts` exists**

```
ls frontend/src/test/setup.ts
```

If it doesn't exist (Phase 3 may have inlined setup), create one and reference it from `vite.config.ts`'s test section. Vitest's default is `src/test/setup.ts`; if the project already configures another path, use that.

- [ ] **Step 2: Write fixtures**

Create `frontend/src/test/msw/fixtures.ts`:

```ts
import type { components } from "../../api/schema";

type User = components["schemas"]["User"];
type Team = components["schemas"]["Team"];
type Task = components["schemas"]["Task"];
type Reward = components["schemas"]["Reward"];
type NewsItem = components["schemas"]["NewsItem"];
type MeTeamsResponse = components["schemas"]["MeTeamsResponse"];
type AuthResponse = components["schemas"]["AuthResponse"];

export const userJet: User = {
  id: "00000000-0000-0000-0000-000000000001",
  display_id: "UJET",
  email: "jet@demo.gal",
  zh_name: "金杰",
  en_name: "Jet Kan",
  nickname: "Jet",
  name: "金杰",
  phone: "912345678",
  phone_code: "+886",
  line_id: null,
  telegram_id: null,
  country: "TW",
  location: "台北",
  avatar_url: null,
  profile_complete: true,
  created_at: "2026-04-20T00:00:00Z",
};

export const userIncomplete: User = {
  ...userJet,
  id: "00000000-0000-0000-0000-000000000099",
  display_id: "UNEW",
  email: "new@demo.gal",
  zh_name: null,
  name: "new",
  profile_complete: false,
};

export const teamJetLed: Team = {
  id: "00000000-0000-0000-0000-000000000010",
  display_id: "T-JET",
  name: "金杰的團隊",
  alias: null,
  topic: "尚未指定主題",
  leader: {
    id: userJet.id,
    display_id: userJet.display_id,
    name: userJet.name,
    avatar_url: null,
  },
  members: [],
  cap: 6,
  points: 0,
  week_points: 0,
  rank: null,
  role: "leader",
  requests: [],
  created_at: "2026-04-20T00:00:00Z",
};

export const myTeams: MeTeamsResponse = { led: teamJetLed, joined: null };

export const tasksList: Task[] = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    display_id: "T1",
    title: "填寫金富有志工表單",
    summary: "完成你的志工個人資料。",
    description: "歡迎加入金富有志工！請填寫基本個人資料。",
    tag: "探索",
    color: "#fec701",
    points: 50,
    bonus: null,
    due_at: null,
    est_minutes: 5,
    is_challenge: false,
    requires: [],
    cap: null,
    form_type: "interest",
    status: "todo",
    progress: 0,
    steps: [],
    team_progress: null,
    created_at: "2026-04-20T00:00:00Z",
  },
];

export const rewardsList: Reward[] = [];
export const newsList: NewsItem[] = [];

export const authResponseJet: AuthResponse = {
  access_token: "test-token-jet",
  token_type: "bearer",
  expires_in: 86400,
  user: userJet,
  profile_complete: true,
};
```

- [ ] **Step 3: Write default handlers**

Create `frontend/src/test/msw/handlers.ts`:

```ts
import { http, HttpResponse } from "msw";
import * as f from "./fixtures";

export const defaultHandlers = [
  http.post("/api/v1/auth/google", () => HttpResponse.json(f.authResponseJet)),
  http.post("/api/v1/auth/logout", () => new HttpResponse(null, { status: 204 })),
  http.get("/api/v1/me", () => HttpResponse.json(f.userJet)),
  http.get("/api/v1/me/tasks", () => HttpResponse.json(f.tasksList)),
  http.get("/api/v1/me/teams", () => HttpResponse.json(f.myTeams)),
  http.get("/api/v1/me/rewards", () => HttpResponse.json(f.rewardsList)),
  http.get("/api/v1/news", () => HttpResponse.json({ items: f.newsList, next_cursor: null })),
  http.get("/api/v1/rank/users", () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
  http.get("/api/v1/rank/teams", () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
  http.get("/api/v1/teams", () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
];
```

- [ ] **Step 4: Write the MSW server bootstrap**

Create `frontend/src/test/msw/server.ts`:

```ts
import { setupServer } from "msw/node";
import { defaultHandlers } from "./handlers";

export const server = setupServer(...defaultHandlers);
```

- [ ] **Step 5: Wire `setup.ts`**

Edit `frontend/src/test/setup.ts` (create if missing). Append (or set) the MSW lifecycle:

```ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());
```

- [ ] **Step 6: Verify Vitest picks up `setup.ts`**

```
grep -n setupFiles frontend/vite.config.ts frontend/vitest.config.ts 2>/dev/null
```

Expected: a `setupFiles` entry pointing at `src/test/setup.ts`. If absent, add it (Vitest auto-detects `src/test/setup.ts` only when configured). If the project uses `vite.config.ts` with a `test` field:

```ts
// inside defineConfig({ test: { ... } })
test: { environment: "jsdom", setupFiles: ["src/test/setup.ts"] },
```

- [ ] **Step 7: Sanity-run the existing test suite**

```
pnpm -C frontend test
```

Expected: existing tests still PASS. `MSW failed to intercept fetch` warnings are normal at this point (no fetches happen yet). Any "unhandled request" *errors* would mean a previously-mocked test now hits the network — investigate before moving on.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/test/msw frontend/src/test/setup.ts frontend/vite.config.ts
git commit -m "test(frontend): MSW infrastructure + canonical fixtures"
```

### Task D3: `apiFetch` + late-bound 401 handler

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/__tests__/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/api/__tests__/client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/msw/server";
import { apiFetch, setSessionExpiredHandler } from "../client";
import { ApiError } from "../errors";
import { tokenStore } from "../../auth/token";

afterEach(() => {
  setSessionExpiredHandler(null);
  tokenStore.clear();
});

describe("apiFetch", () => {
  it("sends Authorization: Bearer when token is set", async () => {
    let seenAuth: string | null = null;
    server.use(
      http.get("/api/v1/me", ({ request }) => {
        seenAuth = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );
    tokenStore.set("token-abc");
    await apiFetch("/me");
    expect(seenAuth).toBe("Bearer token-abc");
  });

  it("omits Authorization when no token", async () => {
    let seenAuth: string | null = "<unset>";
    server.use(
      http.get("/api/v1/me", ({ request }) => {
        seenAuth = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );
    await apiFetch("/me");
    expect(seenAuth).toBeNull();
  });

  it("returns parsed JSON on 200", async () => {
    server.use(http.get("/api/v1/me", () => HttpResponse.json({ x: 1 })));
    const data = await apiFetch<{ x: number }>("/me");
    expect(data).toEqual({ x: 1 });
  });

  it("returns undefined on 204", async () => {
    server.use(
      http.post("/api/v1/auth/logout", () => new HttpResponse(null, { status: 204 })),
    );
    const data = await apiFetch<void>("/auth/logout", { method: "POST" });
    expect(data).toBeUndefined();
  });

  it("throws ApiError with detail on non-2xx", async () => {
    server.use(
      http.get("/api/v1/teams/x", () =>
        HttpResponse.json({ detail: "team not found" }, { status: 404 }),
      ),
    );
    await expect(apiFetch("/teams/x")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      detail: "team not found",
    });
  });

  it("falls back to statusText when body lacks detail", async () => {
    server.use(
      http.get("/api/v1/me", () =>
        HttpResponse.text("not json", { status: 500, statusText: "Server Error" }),
      ),
    );
    await expect(apiFetch("/me")).rejects.toMatchObject({
      status: 500,
      detail: "Server Error",
    });
  });

  it("calls registered session-expired handler on 401", async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    server.use(
      http.get("/api/v1/me", () => new HttpResponse(null, { status: 401 })),
    );
    await expect(apiFetch("/me")).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      returnTo: expect.any(String),
    });
  });

  it("does not throw when no 401 handler is registered", async () => {
    server.use(
      http.get("/api/v1/me", () => new HttpResponse(null, { status: 401 })),
    );
    await expect(apiFetch("/me")).rejects.toBeInstanceOf(ApiError);
    // No throw from the (null) handler call itself.
  });
});
```

- [ ] **Step 2: Write a stub `tokenStore` to satisfy the import**

Create `frontend/src/auth/token.ts`:

```ts
const KEY = "gal.token";

export const tokenStore = {
  get(): string | null {
    return localStorage.getItem(KEY);
  },
  set(token: string): void {
    localStorage.setItem(KEY, token);
  },
  clear(): void {
    localStorage.removeItem(KEY);
  },
};
```

(Section E adds the dedicated test for this; the file is needed here so `client.test.ts` can import it.)

- [ ] **Step 3: Write `apiFetch`**

Create `frontend/src/api/client.ts`:

```ts
import { tokenStore } from "../auth/token";
import { ApiError } from "./errors";

type SessionExpiredHandler = ((opts: { returnTo: string }) => void) | null;

let onSessionExpired: SessionExpiredHandler = null;

export function setSessionExpiredHandler(fn: SessionExpiredHandler): void {
  onSessionExpired = fn;
}

const BASE = "/api/v1";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    onSessionExpired?.({
      returnTo: window.location.pathname + window.location.search,
    });
    throw new ApiError(401, "Session expired");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body.detail === "string") detail = body.detail;
    } catch {
      // body wasn't JSON; keep statusText
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

- [ ] **Step 4: Run the tests**

```
pnpm -C frontend test src/api/__tests__/client.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/auth/token.ts frontend/src/api/client.ts frontend/src/api/__tests__/client.test.ts
git commit -m "feat(frontend): apiFetch with bearer + 401 + ApiError"
```

### Task D4: Per-resource API modules

**Files:**
- Create: `frontend/src/api/{auth,me,tasks,teams,rank,news,index}.ts`

These files are thin wrappers — no business logic, no tests of their own (the per-mutation/per-query tests below cover the URLs and request bodies). One step per file for visibility.

- [ ] **Step 1: `auth.ts`**

```ts
// frontend/src/api/auth.ts
import type { components } from "./schema";
import { apiFetch } from "./client";

type AuthResponse = components["schemas"]["AuthResponse"];
type GoogleAuthRequest = components["schemas"]["GoogleAuthRequest"];

export function postGoogleAuth(body: GoogleAuthRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postLogout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}
```

- [ ] **Step 2: `me.ts`**

```ts
// frontend/src/api/me.ts
import type { components } from "./schema";
import { apiFetch } from "./client";

type User = components["schemas"]["User"];
type Task = components["schemas"]["Task"];
type Reward = components["schemas"]["Reward"];
type MeTeamsResponse = components["schemas"]["MeTeamsResponse"];
type MeProfileCreateResponse = components["schemas"]["MeProfileCreateResponse"];
type ProfileCreate = components["schemas"]["ProfileCreate"];
type ProfileUpdate = components["schemas"]["ProfileUpdate"];

export const getMe = (): Promise<User> => apiFetch<User>("/me");
export const getMyTasks = (): Promise<Task[]> => apiFetch<Task[]>("/me/tasks");
export const getMyTeams = (): Promise<MeTeamsResponse> => apiFetch<MeTeamsResponse>("/me/teams");
export const getMyRewards = (): Promise<Reward[]> => apiFetch<Reward[]>("/me/rewards");

export const postProfile = (body: ProfileCreate): Promise<MeProfileCreateResponse> =>
  apiFetch<MeProfileCreateResponse>("/me/profile", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const patchMe = (body: ProfileUpdate): Promise<User> =>
  apiFetch<User>("/me", { method: "PATCH", body: JSON.stringify(body) });
```

- [ ] **Step 3: `tasks.ts`**

```ts
// frontend/src/api/tasks.ts
import type { components } from "./schema";
import { apiFetch } from "./client";

type Task = components["schemas"]["Task"];
type SubmitBody = components["schemas"]["InterestFormBody"] | components["schemas"]["TicketFormBody"];
type TaskSubmissionResponse = components["schemas"]["TaskSubmissionResponse"];

export const getTask = (id: string): Promise<Task> => apiFetch<Task>(`/tasks/${id}`);

export const submitTask = (id: string, body: SubmitBody): Promise<TaskSubmissionResponse> =>
  apiFetch<TaskSubmissionResponse>(`/tasks/${id}/submit`, {
    method: "POST",
    body: JSON.stringify(body),
  });
```

- [ ] **Step 4: `teams.ts`**

```ts
// frontend/src/api/teams.ts
import type { components } from "./schema";
import { apiFetch } from "./client";

type Team = components["schemas"]["Team"];
type TeamRef = components["schemas"]["TeamRef"];
type TeamUpdate = components["schemas"]["TeamUpdate"];
type JoinRequest = components["schemas"]["JoinRequest"];
type Paginated<T> = { items: T[]; next_cursor: string | null };

export interface TeamSearchParams {
  q?: string;
  topic?: string;
  leader_display_id?: string;
  cursor?: string;
  limit?: number;
}

function qs(params: TeamSearchParams): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const listTeams = (params: TeamSearchParams = {}): Promise<Paginated<TeamRef>> =>
  apiFetch<Paginated<TeamRef>>(`/teams${qs(params)}`);

export const getTeam = (id: string): Promise<Team> => apiFetch<Team>(`/teams/${id}`);

export const patchTeam = (id: string, body: TeamUpdate): Promise<Team> =>
  apiFetch<Team>(`/teams/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const createJoinRequest = (teamId: string): Promise<JoinRequest> =>
  apiFetch<JoinRequest>(`/teams/${teamId}/join-requests`, { method: "POST" });

export const cancelJoinRequest = (teamId: string, reqId: string): Promise<void> =>
  apiFetch<void>(`/teams/${teamId}/join-requests/${reqId}`, { method: "DELETE" });

export const approveJoinRequest = (teamId: string, reqId: string): Promise<Team> =>
  apiFetch<Team>(`/teams/${teamId}/join-requests/${reqId}/approve`, { method: "POST" });

export const rejectJoinRequest = (teamId: string, reqId: string): Promise<void> =>
  apiFetch<void>(`/teams/${teamId}/join-requests/${reqId}/reject`, { method: "POST" });

export const leaveTeam = (teamId: string): Promise<void> =>
  apiFetch<void>(`/teams/${teamId}/leave`, { method: "POST" });
```

- [ ] **Step 5: `rank.ts`**

```ts
// frontend/src/api/rank.ts
import type { components } from "./schema";
import { apiFetch } from "./client";

type RankPeriod = components["schemas"]["RankPeriod"];
type UserRankEntry = components["schemas"]["UserRankEntry"];
type TeamRankEntry = components["schemas"]["TeamRankEntry"];
type Paginated<T> = { items: T[]; next_cursor: string | null };

interface RankParams {
  period: RankPeriod;
  cursor?: string;
  limit?: number;
}

function qs(p: RankParams): string {
  const usp = new URLSearchParams({ period: p.period });
  if (p.cursor) usp.set("cursor", p.cursor);
  if (p.limit) usp.set("limit", String(p.limit));
  return `?${usp.toString()}`;
}

export const listUserRank = (p: RankParams): Promise<Paginated<UserRankEntry>> =>
  apiFetch<Paginated<UserRankEntry>>(`/rank/users${qs(p)}`);

export const listTeamRank = (p: RankParams): Promise<Paginated<TeamRankEntry>> =>
  apiFetch<Paginated<TeamRankEntry>>(`/rank/teams${qs(p)}`);
```

- [ ] **Step 6: `news.ts`**

```ts
// frontend/src/api/news.ts
import type { components } from "./schema";
import { apiFetch } from "./client";

type NewsItem = components["schemas"]["NewsItem"];
type Paginated<T> = { items: T[]; next_cursor: string | null };

export const listNews = (
  cursor?: string,
  limit?: number,
): Promise<Paginated<NewsItem>> => {
  const usp = new URLSearchParams();
  if (cursor) usp.set("cursor", cursor);
  if (limit) usp.set("limit", String(limit));
  const s = usp.toString();
  return apiFetch<Paginated<NewsItem>>(`/news${s ? `?${s}` : ""}`);
};
```

- [ ] **Step 7: `index.ts` namespace re-export**

```ts
// frontend/src/api/index.ts
export * as auth from "./auth";
export * as me from "./me";
export * as tasks from "./tasks";
export * as teams from "./teams";
export * as rank from "./rank";
export * as news from "./news";
export { ApiError } from "./errors";
export { apiFetch, setSessionExpiredHandler } from "./client";
```

- [ ] **Step 8: Typecheck**

```
pnpm -C frontend exec tsc --noEmit
```

Expected: zero errors. Common failure: a contract field's TypeScript name differs from what the resource module imports — adjust by reading `schema.d.ts` for the actual name.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/api
git commit -m "feat(frontend): per-resource API modules over apiFetch"
```

### Task D5: `tokenStore` round-trip test

**Files:**
- Create: `frontend/src/auth/__tests__/token.test.ts`

- [ ] **Step 1: Write test**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { tokenStore } from "../token";

afterEach(() => tokenStore.clear());

describe("tokenStore", () => {
  it("returns null when unset", () => {
    expect(tokenStore.get()).toBeNull();
  });
  it("round-trips set/get", () => {
    tokenStore.set("abc");
    expect(tokenStore.get()).toBe("abc");
  });
  it("clear removes the key", () => {
    tokenStore.set("abc");
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
  });
});
```

- [ ] **Step 2: Run, commit**

```
pnpm -C frontend test src/auth/__tests__/token.test.ts
```

Expected: 3 PASS.

```bash
git add frontend/src/auth/__tests__/token.test.ts
git commit -m "test(frontend): tokenStore round-trip"
```

---

## Section E — Query/mutation factories

**Exit criteria:** Every query and mutation factory referenced in spec §6 exists and compiles. The query-key factory has a regression test. One mutation file has a default-invalidate behavior test as a template.

### Task E1: Query-key factory

**Files:**
- Create: `frontend/src/queries/keys.ts`
- Create: `frontend/src/queries/__tests__/keys.test.ts`

- [ ] **Step 1: Write the keys**

```ts
// frontend/src/queries/keys.ts
import type { components } from "../api/schema";
import type { TeamSearchParams } from "../api/teams";

type RankPeriod = components["schemas"]["RankPeriod"];

export const qk = {
  me: ["me"] as const,
  myTasks: ["me", "tasks"] as const,
  myTeams: ["me", "teams"] as const,
  myRewards: ["me", "rewards"] as const,
  task: (id: string) => ["tasks", id] as const,
  teams: (params: TeamSearchParams) => ["teams", params] as const,
  team: (id: string) => ["teams", id] as const,
  rankUsers: (period: RankPeriod) => ["rank", "users", period] as const,
  rankTeams: (period: RankPeriod) => ["rank", "teams", period] as const,
  news: ["news"] as const,
} as const;
```

- [ ] **Step 2: Write the regression test**

```ts
// frontend/src/queries/__tests__/keys.test.ts
import { describe, expect, it } from "vitest";
import { qk } from "../keys";

describe("qk", () => {
  it("static keys are stable", () => {
    expect(qk.me).toEqual(["me"]);
    expect(qk.myTasks).toEqual(["me", "tasks"]);
    expect(qk.myTeams).toEqual(["me", "teams"]);
    expect(qk.myRewards).toEqual(["me", "rewards"]);
    expect(qk.news).toEqual(["news"]);
  });

  it("task(id) shares the 'tasks' prefix with team()", () => {
    expect(qk.task("X").slice(0, 1)).toEqual(["tasks"]);
    expect(qk.team("X").slice(0, 1)).toEqual(["teams"]);
  });

  it("rank keys share the 'rank' prefix for broad invalidation", () => {
    expect(qk.rankUsers("week").slice(0, 1)).toEqual(["rank"]);
    expect(qk.rankTeams("week").slice(0, 1)).toEqual(["rank"]);
  });
});
```

- [ ] **Step 3: Run, commit**

```
pnpm -C frontend test src/queries/__tests__/keys.test.ts
```

Expected: 3 PASS.

```bash
git add frontend/src/queries/keys.ts frontend/src/queries/__tests__/keys.test.ts
git commit -m "feat(frontend): qk query-key factory + regression test"
```

### Task E2: queryOptions factories

**Files:**
- Create: `frontend/src/queries/{me,tasks,teams,rank,news}.ts`

One file per step.

- [ ] **Step 1: `me.ts`**

```ts
// frontend/src/queries/me.ts
import { queryOptions } from "@tanstack/react-query";
import * as api from "../api/me";
import { qk } from "./keys";

export const meQueryOptions = () =>
  queryOptions({
    queryKey: qk.me,
    queryFn: () => api.getMe(),
    staleTime: 60_000,
  });

export const myTasksQueryOptions = () =>
  queryOptions({
    queryKey: qk.myTasks,
    queryFn: () => api.getMyTasks(),
    staleTime: 30_000,
  });

export const myTeamsQueryOptions = () =>
  queryOptions({
    queryKey: qk.myTeams,
    queryFn: () => api.getMyTeams(),
    staleTime: 60_000,
  });

export const myRewardsQueryOptions = () =>
  queryOptions({
    queryKey: qk.myRewards,
    queryFn: () => api.getMyRewards(),
    staleTime: 30_000,
  });
```

- [ ] **Step 2: `tasks.ts`**

```ts
// frontend/src/queries/tasks.ts
import { queryOptions } from "@tanstack/react-query";
import * as api from "../api/tasks";
import { qk } from "./keys";

export const taskQueryOptions = (uuid: string) =>
  queryOptions({
    queryKey: qk.task(uuid),
    queryFn: () => api.getTask(uuid),
    staleTime: 60_000,
  });
```

- [ ] **Step 3: `teams.ts`**

```ts
// frontend/src/queries/teams.ts
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import * as api from "../api/teams";
import type { TeamSearchParams } from "../api/teams";
import { qk } from "./keys";

export const teamQueryOptions = (uuid: string) =>
  queryOptions({
    queryKey: qk.team(uuid),
    queryFn: () => api.getTeam(uuid),
    staleTime: 60_000,
  });

export const teamsInfiniteQueryOptions = (params: TeamSearchParams = {}) =>
  infiniteQueryOptions({
    queryKey: qk.teams(params),
    queryFn: ({ pageParam }) =>
      api.listTeams({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 10_000,
  });
```

- [ ] **Step 4: `rank.ts`**

```ts
// frontend/src/queries/rank.ts
import { infiniteQueryOptions } from "@tanstack/react-query";
import * as api from "../api/rank";
import type { components } from "../api/schema";
import { qk } from "./keys";

type RankPeriod = components["schemas"]["RankPeriod"];

export const rankUsersInfiniteQueryOptions = (period: RankPeriod) =>
  infiniteQueryOptions({
    queryKey: qk.rankUsers(period),
    queryFn: ({ pageParam }) => api.listUserRank({ period, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 5 * 60_000,
  });

export const rankTeamsInfiniteQueryOptions = (period: RankPeriod) =>
  infiniteQueryOptions({
    queryKey: qk.rankTeams(period),
    queryFn: ({ pageParam }) => api.listTeamRank({ period, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 5 * 60_000,
  });
```

- [ ] **Step 5: `news.ts`**

```ts
// frontend/src/queries/news.ts
import { infiniteQueryOptions } from "@tanstack/react-query";
import * as api from "../api/news";
import { qk } from "./keys";

export const newsInfiniteQueryOptions = () =>
  infiniteQueryOptions({
    queryKey: qk.news,
    queryFn: ({ pageParam }) => api.listNews(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 5 * 60_000,
  });
```

- [ ] **Step 6: Typecheck + commit**

```
pnpm -C frontend exec tsc --noEmit
```

Expected: zero errors.

```bash
git add frontend/src/queries
git commit -m "feat(frontend): queryOptions factories for all resources"
```

### Task E3: Mutation factories (default-invalidate)

**Files:**
- Create: `frontend/src/mutations/{me,tasks,teams}.ts`
- Create: `frontend/src/mutations/__tests__/me.test.ts`

This task lands the default-invalidate shape from spec §6.1. Optimistic patches arrive in plan 4c.

- [ ] **Step 1: `me.ts`**

```ts
// frontend/src/mutations/me.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/me";
import { qk } from "../queries/keys";
import type { components } from "../api/schema";

type ProfileCreate = components["schemas"]["ProfileCreate"];
type ProfileUpdate = components["schemas"]["ProfileUpdate"];

export function useCompleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileCreate) => api.postProfile(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: qk.myTasks });
    },
  });
}

export function usePatchMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileUpdate) => api.patchMe(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
```

- [ ] **Step 2: `tasks.ts`**

```ts
// frontend/src/mutations/tasks.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/tasks";
import { qk } from "../queries/keys";
import type { components } from "../api/schema";

type SubmitBody =
  | components["schemas"]["InterestFormBody"]
  | components["schemas"]["TicketFormBody"];

export function useSubmitTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SubmitBody }) =>
      api.submitTask(id, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: qk.task(id) });
      qc.invalidateQueries({ queryKey: qk.myTasks });
      qc.invalidateQueries({ queryKey: qk.myRewards });
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: ["rank"] });
    },
  });
}
```

- [ ] **Step 3: `teams.ts`**

```ts
// frontend/src/mutations/teams.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/teams";
import { qk } from "../queries/keys";
import type { components } from "../api/schema";

type TeamUpdate = components["schemas"]["TeamUpdate"];

export function useCreateJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => api.createJoinRequest(teamId),
    onSuccess: (_data, teamId) => {
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.myTeams });
    },
  });
}

export function useCancelJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, reqId }: { teamId: string; reqId: string }) =>
      api.cancelJoinRequest(teamId, reqId),
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.myTeams });
    },
  });
}

export function useApproveJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, reqId }: { teamId: string; reqId: string }) =>
      api.approveJoinRequest(teamId, reqId),
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.myTasks });
      qc.invalidateQueries({ queryKey: qk.myRewards });
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: ["rank"] });
    },
  });
}

export function useRejectJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, reqId }: { teamId: string; reqId: string }) =>
      api.rejectJoinRequest(teamId, reqId),
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
    },
  });
}

export function useLeaveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => api.leaveTeam(teamId),
    onSuccess: (_data, teamId) => {
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: qk.myTasks });
      qc.invalidateQueries({ queryKey: qk.myRewards });
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: ["rank"] });
    },
  });
}

export function usePatchTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, body }: { teamId: string; body: TeamUpdate }) =>
      api.patchTeam(teamId, body),
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
```

- [ ] **Step 4: Write a behavior test for `useCompleteProfile`**

Create `frontend/src/mutations/__tests__/me.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../../test/msw/server";
import { useCompleteProfile } from "../me";
import { qk } from "../../queries/keys";
import * as f from "../../test/msw/fixtures";

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useCompleteProfile", () => {
  it("invalidates qk.me, qk.myTeams, qk.myTasks on success", async () => {
    server.use(
      http.post("/api/v1/me/profile", () =>
        HttpResponse.json({ user: f.userJet, led_team: f.teamJetLed }),
      ),
    );
    const qc = makeClient();
    const spy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useCompleteProfile(), {
      wrapper: wrapper(qc),
    });

    result.current.mutate({
      zh_name: "金杰",
      phone: "0912",
      phone_code: "+886",
      country: "TW",
      location: "台北",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledKeys = spy.mock.calls.map(([opts]) => (opts as { queryKey: unknown }).queryKey);
    expect(calledKeys).toEqual(
      expect.arrayContaining([qk.me, qk.myTeams, qk.myTasks]),
    );
  });
});
```

- [ ] **Step 5: Run, fix, commit**

```
pnpm -C frontend test src/mutations/__tests__/me.test.ts
pnpm -C frontend exec tsc --noEmit
```

Expected: 1 PASS, no typecheck errors.

```bash
git add frontend/src/mutations
git commit -m "feat(frontend): mutation factories with default invalidate"
```

---

## Section F — `UIStateProvider` + late-bound toast handler

**Exit criteria:** `UIStateProvider` mounts and registers `pushToast` as the late-bound sink. `setSuccessData` works through `useUIState`.

### Task F1: `ui/toasts.ts` module-level sink

**Files:**
- Create: `frontend/src/ui/toasts.ts`

- [ ] **Step 1: Write**

```ts
// frontend/src/ui/toasts.ts
export type Toast = {
  id?: string; // assigned by the sink
  kind: "info" | "error" | "success";
  message: string;
};

type ToastSink = ((t: Toast) => void) | null;

let sink: ToastSink = null;

export function setToastSink(fn: ToastSink): void {
  sink = fn;
}

export function pushToast(t: Toast): void {
  sink?.(t);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/ui/toasts.ts
git commit -m "feat(frontend): module-level pushToast sink"
```

### Task F2: `UIStateProvider` + `useUIState`

**Files:**
- Create: `frontend/src/ui/UIStateProvider.tsx`
- Create: `frontend/src/ui/useUIState.ts`
- Create: `frontend/src/ui/__tests__/UIStateProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/ui/__tests__/UIStateProvider.test.tsx
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { UIStateProvider } from "../UIStateProvider";
import { useUIState } from "../useUIState";
import { pushToast } from "../toasts";

function Probe() {
  const { successData, setSuccessData, toasts } = useUIState();
  return (
    <div>
      <div data-testid="success">{successData ? successData.bonus ?? "yes" : "no"}</div>
      <div data-testid="toast-count">{toasts.length}</div>
      <button onClick={() => setSuccessData({ color: "#fff", points: 50, bonus: "ok" })}>
        push success
      </button>
    </div>
  );
}

describe("UIStateProvider", () => {
  it("starts with no successData and no toasts", () => {
    render(
      <UIStateProvider>
        <Probe />
      </UIStateProvider>,
    );
    expect(screen.getByTestId("success")).toHaveTextContent("no");
    expect(screen.getByTestId("toast-count")).toHaveTextContent("0");
  });

  it("setSuccessData updates state", () => {
    render(
      <UIStateProvider>
        <Probe />
      </UIStateProvider>,
    );
    act(() => screen.getByText("push success").click());
    expect(screen.getByTestId("success")).toHaveTextContent("ok");
  });

  it("registers pushToast sink that flows into the toasts list", () => {
    render(
      <UIStateProvider>
        <Probe />
      </UIStateProvider>,
    );
    act(() => pushToast({ kind: "info", message: "hello" }));
    expect(screen.getByTestId("toast-count")).toHaveTextContent("1");
  });
});
```

- [ ] **Step 2: Run; expect failure**

```
pnpm -C frontend test src/ui/__tests__/UIStateProvider.test.tsx
```

Expected: module-not-found.

- [ ] **Step 3: Write the provider**

```tsx
// frontend/src/ui/UIStateProvider.tsx
import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { setToastSink, type Toast } from "./toasts";

export interface SuccessData {
  color: string;
  points: number;
  bonus?: string | null;
  title?: string;
}

interface UIState {
  successData: SuccessData | null;
  setSuccessData: (d: SuccessData | null) => void;
  toasts: Toast[];
  dismissToast: (id: string) => void;
}

export const UIStateCtx = createContext<UIState | null>(null);

let nextId = 0;

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const enqueue = useCallback((t: Toast) => {
    nextId += 1;
    const withId = { ...t, id: t.id ?? `t-${nextId}` };
    setToasts((prev) => [...prev, withId]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    setToastSink(enqueue);
    return () => setToastSink(null);
  }, [enqueue]);

  return (
    <UIStateCtx.Provider
      value={{ successData, setSuccessData, toasts, dismissToast }}
    >
      {children}
    </UIStateCtx.Provider>
  );
}
```

- [ ] **Step 4: Write the hook**

```ts
// frontend/src/ui/useUIState.ts
import { useContext } from "react";
import { UIStateCtx } from "./UIStateProvider";

export function useUIState() {
  const ctx = useContext(UIStateCtx);
  if (!ctx) throw new Error("useUIState must be used inside <UIStateProvider>");
  return ctx;
}

export { pushToast } from "./toasts";
```

- [ ] **Step 5: Run; commit**

```
pnpm -C frontend test src/ui/__tests__/UIStateProvider.test.tsx
```

Expected: 3 PASS.

```bash
git add frontend/src/ui
git commit -m "feat(frontend): UIStateProvider + useUIState + pushToast wiring"
```

---

## Section G — `AuthProvider` scaffolding

**Exit criteria:** `AuthProvider` exposes `useAuth()` with `{isSignedIn, signIn, signOut}`. `signIn(email)` calls `postGoogleAuth`, stores the token, seeds `qk.me`. `signOut()` clears, navigates, fires the registered handler. `setSessionExpiredHandler` is registered at module init (covered by E2E in plan 4c, sanity-checked here).

### Task G1: `AuthProvider` + `useAuth`

**Files:**
- Create: `frontend/src/auth/session.ts`
- Create: `frontend/src/auth/__tests__/session.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/auth/__tests__/session.test.tsx
import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../../test/msw/server";
import { AuthProvider, useAuth } from "../session";
import { tokenStore } from "../token";
import { qk } from "../../queries/keys";
import * as f from "../../test/msw/fixtures";

function probe(qc: QueryClient) {
  function Probe() {
    const { isSignedIn, signIn, signOut } = useAuth();
    return (
      <div>
        <div data-testid="signed">{String(isSignedIn)}</div>
        <button onClick={() => signIn("jet@demo.gal")}>in</button>
        <button onClick={() => signOut()}>out</button>
      </div>
    );
  }
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  tokenStore.clear();
});

describe("AuthProvider", () => {
  it("starts signed out when no token in localStorage", () => {
    const qc = new QueryClient();
    probe(qc);
    expect(screen.getByTestId("signed")).toHaveTextContent("false");
  });

  it("starts signed in when a token already exists", () => {
    tokenStore.set("existing");
    const qc = new QueryClient();
    probe(qc);
    expect(screen.getByTestId("signed")).toHaveTextContent("true");
  });

  it("signIn stores the token and seeds qk.me", async () => {
    server.use(
      http.post("/api/v1/auth/google", () => HttpResponse.json(f.authResponseJet)),
    );
    const qc = new QueryClient();
    probe(qc);
    act(() => screen.getByText("in").click());
    await waitFor(() => expect(screen.getByTestId("signed")).toHaveTextContent("true"));
    expect(tokenStore.get()).toBe(f.authResponseJet.access_token);
    expect(qc.getQueryData(qk.me)).toEqual(f.userJet);
  });

  it("signOut clears the token and the cache", async () => {
    tokenStore.set("existing");
    const qc = new QueryClient();
    qc.setQueryData(qk.me, f.userJet);
    probe(qc);
    server.use(
      http.post("/api/v1/auth/logout", () => new HttpResponse(null, { status: 204 })),
    );
    act(() => screen.getByText("out").click());
    await waitFor(() => expect(screen.getByTestId("signed")).toHaveTextContent("false"));
    expect(tokenStore.get()).toBeNull();
    expect(qc.getQueryData(qk.me)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run; expect failure**

```
pnpm -C frontend test src/auth/__tests__/session.test.tsx
```

Expected: module-not-found.

- [ ] **Step 3: Write `session.ts`**

```tsx
// frontend/src/auth/session.ts
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as authApi from "../api/auth";
import { setSessionExpiredHandler } from "../api/client";
import { qk } from "../queries/keys";
import { pushToast } from "../ui/toasts";
import { tokenStore } from "./token";

export interface SignOutOpts {
  reason?: "expired" | "user";
  returnTo?: string;
}

interface AuthCtx {
  isSignedIn: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: (opts?: SignOutOpts) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

let inFlightSignOut = false;

async function performLogoutBestEffort(token: string): Promise<void> {
  try {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // best-effort; ignore network failures
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState<boolean>(() => !!tokenStore.get());

  const signIn = useCallback(
    async (email: string) => {
      const res = await authApi.postGoogleAuth({ id_token: email });
      tokenStore.set(res.access_token);
      qc.setQueryData(qk.me, res.user);
      setSignedIn(true);
    },
    [qc],
  );

  const signOut = useCallback(
    async (opts: SignOutOpts = {}) => {
      if (inFlightSignOut) return;
      inFlightSignOut = true;
      try {
        const token = tokenStore.get();
        if (token) void performLogoutBestEffort(token);
        tokenStore.clear();
        setSignedIn(false);
        if (opts.reason === "expired") {
          pushToast({ kind: "info", message: "您的工作階段已過期，請重新登入" });
        }
        // Cache clear last so any in-flight queries don't refetch with the
        // (now-cleared) token mid-teardown. Plan 4c wires router.navigate here.
        qc.clear();
      } finally {
        inFlightSignOut = false;
      }
    },
    [qc],
  );

  return <Ctx.Provider value={{ isSignedIn: signedIn, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// Module-level registration so the 401 interceptor can dispatch outside
// the React tree. The handler captures the latest QueryClient via a
// holder set when AuthProvider mounts.
let activeQueryClient: QueryClient | null = null;
export function _setActiveQueryClient(qc: QueryClient | null): void {
  activeQueryClient = qc;
}

setSessionExpiredHandler(({ returnTo }) => {
  // Best-effort: the *active* AuthProvider clears its token + cache. If
  // no provider has mounted yet, drop the token directly so subsequent
  // requests don't loop. The full router-navigate flow lands in plan 4c.
  tokenStore.clear();
  pushToast({ kind: "info", message: "您的工作階段已過期，請重新登入" });
  activeQueryClient?.clear();
  // returnTo is preserved by the caller via window.location; plan 4c
  // wires router.navigate({ to: '/sign-in', search: { returnTo } }).
  void returnTo;
});
```

Note: this leaves the router-navigate work for plan 4c (which adds the router). Today the handler clears state and queues the toast — enough for any 401 to fully tear down the session, no infinite refetch loops. The "navigate to /sign-in" piece arrives when `AuthProvider` is actually mounted under the router in plan 4b.

- [ ] **Step 4: Wire `_setActiveQueryClient` from the provider**

Add to `AuthProvider` before the existing `useState`:

```tsx
import { useEffect } from "react";
// ...
useEffect(() => {
  _setActiveQueryClient(qc);
  return () => _setActiveQueryClient(null);
}, [qc]);
```

- [ ] **Step 5: Run, commit**

```
pnpm -C frontend test src/auth/__tests__/session.test.tsx
pnpm -C frontend exec tsc --noEmit
```

Expected: 4 PASS, no type errors.

```bash
git add frontend/src/auth
git commit -m "feat(frontend): AuthProvider scaffolding (no router wire-in yet)"
```

---

## Section H — `dev/demo-accounts.ts` typed wrapper

**Exit criteria:** `frontend/src/dev/demo-accounts.ts` exports a typed list importable by the sign-in screen (wired in plan 4b).

### Task H1: Typed wrapper

**Files:**
- Create: `frontend/src/dev/demo-accounts.ts`

- [ ] **Step 1: Write**

```ts
// frontend/src/dev/demo-accounts.ts
//
// Source of truth: backend/src/backend/seed.py DEMO_USERS, dumped via
// `just gen-demo-accounts`. Regenerate the JSON when DEMO_USERS changes.
import accounts from "./demo-accounts.json";

export interface DemoAccount {
  email: string;
  label: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = accounts;
```

- [ ] **Step 2: Ensure `tsconfig.json` allows JSON imports**

```
grep -n resolveJsonModule frontend/tsconfig.json
```

Expected: `"resolveJsonModule": true`. If absent, add it under `compilerOptions`.

- [ ] **Step 3: Typecheck + commit**

```
pnpm -C frontend exec tsc --noEmit
```

```bash
git add frontend/src/dev/demo-accounts.ts frontend/tsconfig.json
git commit -m "feat(frontend): typed wrapper for generated demo-accounts.json"
```

---

## Section I — Final verification

**Exit criteria:** the whole suite passes; no `useAppState` callsites changed; existing tests pass with MSW running.

### Task I1: Full local pass

- [ ] **Step 1: Backend CI**

```
just -f backend/justfile ci
```

Expected: PASS.

- [ ] **Step 2: Frontend tests + typecheck + build**

```
pnpm -C frontend test
pnpm -C frontend exec tsc --noEmit
pnpm -C frontend build
```

Expected: all PASS. If `pnpm -C frontend build` fails on missing `schema.d.ts`, run `just gen-types` first — CI will need to do the same.

- [ ] **Step 3: `useAppState` callsite count is unchanged**

```
git fetch origin main
BEFORE=$(git grep -c useAppState origin/main -- frontend/src/ | awk -F: '{s+=$NF} END {print s}')
AFTER=$(git grep -c useAppState HEAD -- frontend/src/ | awk -F: '{s+=$NF} END {print s}')
echo "before=$BEFORE after=$AFTER"
test "$BEFORE" = "$AFTER" && echo OK
```

Expected: `OK`. If counts differ, something in this PR replaced an `useAppState` callsite — that belongs in plan 4b. Revert the callsite change before merging.

- [ ] **Step 4: `seed-reset` smoke**

```
just -f backend/justfile db-up
just -f backend/justfile migrate
just -f backend/justfile seed-reset
just -f backend/justfile seed
```

Expected: both `seed-reset` and the trailing `seed` succeed; the second `seed` adds zero rows.

- [ ] **Step 5: `gen-demo-accounts` round-trip**

```
just gen-demo-accounts
git diff --exit-code frontend/src/dev/demo-accounts.json
```

Expected: zero diff (the checked-in JSON already matches `DEMO_USERS`).

- [ ] **Step 6: Commit any final lockfile / generated-file updates and open the PR**

```bash
git status
# stage any lockfile updates
git add frontend/pnpm-lock.yaml backend/uv.lock 2>/dev/null
git diff --cached --quiet || git commit -m "chore: lockfile updates from phase-4a"
```

---

## Out of scope for plan 4a (handled by 4b / 4c)

- Wiring `GoogleAuthScreen` to `signIn` — plan 4b
- `_authed` route's switch from `context.auth.user` to `tokenStore` — plan 4b
- Any `useAppState()` callsite replacement — plans 4b (read side) and 4c (write side)
- `AppStateContext.tsx` deletion — plan 4c
- Optimistic mutation patches — plan 4c
- Router-aware 401 navigation (`router.navigate({ to: '/sign-in', search: { returnTo } })`) — plan 4c
- Snake_case rename of `frontend/src/types.ts` — plan 4b (deletion happens there, alongside the screen migrations)
- 401 interceptor end-to-end test (loader → 401 → redirect → toast) — plan 4c
