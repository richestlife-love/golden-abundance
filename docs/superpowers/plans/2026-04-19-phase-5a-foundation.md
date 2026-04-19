# Phase 5a — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a runnable FastAPI + Postgres backend with Alembic migrations and a testcontainers-backed pytest harness.

**Prereqs:** None

**Architecture:** Shares the scoping decisions from the Phase 5 suite — thin layered design inside `backend/` with `db/`, `auth/`, `services/`, `routers/`. SQLModel tables are the persistence shape; `backend.contract` stays untouched as the wire-format source of truth.

**Tech Stack:** Python 3.14, FastAPI, SQLModel (SQLAlchemy 2.0 async), psycopg3, Alembic, PyJWT, Pydantic Settings, uv, pytest + pytest-asyncio + httpx + testcontainers[postgresql], Postgres 17.

**Spec:** `docs/superpowers/specs/2026-04-19-phase-2-api-contract-design.md` + `backend/src/backend/contract/endpoints.md`.

**Exit criteria:** `just -f backend/justfile ci` green; `GET /health` returns 200; `alembic upgrade head` applies all 11 tables.

---

## Scoping decisions locked before drafting

| Decision | Choice | Why |
|---|---|---|
| DB driver | `psycopg[binary]>=3` (async) | Modern, excellent async story, no libpq system dep with binary wheel. |
| ORM | SQLModel + SQLAlchemy 2.0 `AsyncSession` | Plan says SQLModel; 0.0.25+ has async that works. |
| Local Postgres | `backend/docker-compose.yml` (`postgres:17-alpine`, named volume) | Docker already in dev stack; simplest way to pin Postgres version. |
| Test Postgres | `testcontainers[postgresql]` session-scoped container | Real-Postgres parity; avoids SQLite/Postgres drift on JSONB etc. |
| Test isolation | `TRUNCATE ... RESTART IDENTITY CASCADE` after each test (SQLModel metadata iterated) | Simpler than a SAVEPOINT harness with async SQLAlchemy; fast enough at Phase-5 volume. |
| JWT library | `PyJWT>=2.10`, HS256, 24h TTL, secret from `JWT_SECRET` env | Standard choice. HS256 is fine for single-service; RS256 is not needed here. |
| Alembic layout | `backend/alembic.ini` + `backend/alembic/` dir; one initial migration covering all tables | New project — no incremental history to preserve. |
| Server entrypoint | `backend.server:create_app` factory; `app = create_app()` module-level for `fastapi-cli` | Matches existing `[tool.fastapi] entrypoint = "backend.server:app"` in `pyproject.toml`. |
| Field naming | snake_case end-to-end (DB, Pydantic, JSON) | Matches spec §6 and the existing contract. |

---

## File plan

Files created (C) or modified (M) by this plan. Paths are relative to repo root `/Users/Jet/Developer/golden-abundance-lite`.

### Backend package

| Path | Action | Contents |
|---|---|---|
| `backend/pyproject.toml` | M | Add runtime deps (fastapi[standard], sqlmodel, alembic, psycopg[binary], pyjwt, pydantic-settings); add dev deps (pytest-asyncio, httpx, testcontainers[postgresql]) |
| `backend/docker-compose.yml` | C | `postgres:17-alpine` service for local dev |
| `backend/.env.example` | C | Documented env vars (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, etc.) |
| `backend/alembic.ini` | C | Alembic config (reads URL from env) |
| `backend/alembic/env.py` | C | Async-aware Alembic env |
| `backend/alembic/script.py.mako` | C | Default Alembic template |
| `backend/alembic/versions/0001_initial.py` | C | Initial schema (all tables) |
| `backend/justfile` | M | Add `dev`, `db-up`, `db-down`, `migrate`, `seed`, `test` recipes; re-add `test` to `ci` |

### `backend/src/backend/` — new modules

| Path | Action | Contents |
|---|---|---|
| `backend/src/backend/config.py` | C | `Settings` (pydantic-settings); `get_settings()` singleton |
| `backend/src/backend/server.py` | C | `create_app()` factory, `app` module-level, `/health`, router wiring, CORS |
| `backend/src/backend/db/__init__.py` | C | Re-exports engine/session helpers |
| `backend/src/backend/db/engine.py` | C | Lazy `get_engine()` / `get_session_maker()` / `reset_engine()` (legacy `engine` / `AsyncSessionLocal` aliases via `__getattr__`) |
| `backend/src/backend/db/session.py` | C | `get_session()` FastAPI dep |
| `backend/src/backend/db/models.py` | C | SQLModel tables: `UserRow`, `TeamRow`, `TeamMembershipRow`, `JoinRequestRow`, `TaskDefRow`, `TaskDefRequiresRow`, `TaskStepDefRow`, `TaskProgressRow`, `TaskStepProgressRow`, `RewardRow`, `NewsItemRow` |
| `backend/src/backend/routers/__init__.py` | C | Re-exports |
| `backend/src/backend/routers/health.py` | C | `/health` |

### `backend/tests/` — new test tree

| Path | Action | Contents |
|---|---|---|
| `backend/tests/__init__.py` | C | (empty) |
| `backend/tests/conftest.py` | C | `postgres_container`, `engine`, `session`, `client`, `no_db_client` fixtures |
| `backend/tests/test_health.py` | C | `/health` smoke |
| `backend/tests/test_config.py` | C | `Settings` validation: prod-env guard, `min_length=32`, CORS comma parsing |
| `backend/tests/test_db_roundtrip.py` | C | Insert/read a `UserRow` through the testcontainer engine |
| `backend/tests/test_schema.py` | C | Schema-drift regression: every model has a table, Literal columns stay VARCHAR(16) |

---

## Section A — Foundation (runnable empty FastAPI + Postgres stack)

**Exit criteria:** `just -f backend/justfile dev` boots FastAPI, `GET /health` returns `200 {"status":"ok"}`, `just -f backend/justfile db-up` starts Postgres locally, one green test.

### Task A1: Add runtime + dev dependencies

**Files:**
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Add runtime dependencies via `uv add`**

Run:
```bash
(cd backend && uv add 'fastapi[standard]>=0.118' 'sqlmodel>=0.0.25' 'alembic>=1.16' 'psycopg[binary]>=3.2' 'pyjwt>=2.10' 'pydantic-settings>=2.7')
```

This edits `backend/pyproject.toml`'s `dependencies` array and updates `backend/uv.lock`.

- [ ] **Step 2: Add dev dependencies via `uv add --dev`**

Run:
```bash
(cd backend && uv add --dev 'pytest-asyncio>=0.24' 'httpx>=0.28' 'testcontainers[postgresql]>=4.9')
```

- [ ] **Step 3: Verify imports resolve**

Run:
```bash
(cd backend && uv run python -c "import fastapi, sqlmodel, alembic, psycopg, jwt, pydantic_settings; print('ok')")
```

Expected: `ok`. No traceback.

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock
git commit -m "$(cat <<'EOF'
phase5: add fastapi, sqlmodel, alembic, psycopg, pyjwt runtime deps

Adds dev deps pytest-asyncio, httpx, testcontainers[postgresql] for
the integration test harness.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task A2: `backend/docker-compose.yml` for local Postgres

**Files:**
- Create: `backend/docker-compose.yml`

- [ ] **Step 1: Write `backend/docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:17-alpine
    container_name: golden-abundance-db
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app"]
      interval: 2s
      timeout: 5s
      retries: 20

volumes:
  pgdata:
```

- [ ] **Step 2: Start the stack and verify**

Run:
```bash
(cd backend && docker compose up -d --wait)
```

Expected: container `golden-abundance-db` is healthy. If `docker` is not installed, note this in the PR and skip (the test suite uses testcontainers which has its own image lifecycle).

- [ ] **Step 3: Tear down**

```bash
(cd backend && docker compose down)
```

- [ ] **Step 4: Commit**

```bash
git add backend/docker-compose.yml
git commit -m "$(cat <<'EOF'
phase5: add docker-compose for local Postgres 17

Pinned postgres:17-alpine, named volume pgdata, health-checked on
pg_isready. Used by `just db-up` in a later task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task A3: `.env.example` + `config.py` (Pydantic Settings)

**Files:**
- Create: `backend/.env.example`
- Create: `backend/src/backend/config.py`

- [ ] **Step 1: Write `backend/.env.example`**

```dotenv
# Copy to backend/.env and edit. backend/.env is gitignored.
DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/app
JWT_SECRET=dev-only-change-me-please-in-prod
JWT_TTL_SECONDS=86400
CORS_ORIGINS=http://localhost:5173,http://localhost:8000
APP_ENV=dev
```

- [ ] **Step 2: Write `backend/src/backend/config.py`**

```python
"""Runtime settings loaded from environment variables.

`Settings` is a pydantic-settings model; `get_settings()` returns a
process-wide cached instance so FastAPI deps can depend on it without
re-reading the environment on every call.

Boot safety: ``get_settings()`` refuses to return a production-env
instance still using the baked-in dev ``JWT_SECRET`` — a deploy that
forgets to set ``JWT_SECRET`` fails fast at app import rather than
silently issuing tokens signed with a public secret.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_JWT_SECRET = "dev-only-change-me-please-in-prod"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(
        default="postgresql+psycopg://app:app@localhost:5432/app",
        description="SQLAlchemy URL (psycopg3 driver).",
    )
    jwt_secret: str = Field(default=_DEV_JWT_SECRET, min_length=32)
    jwt_ttl_seconds: int = Field(default=86400, ge=60)
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:8000"]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v: object) -> object:
        """Accept either JSON array or comma-separated env-var form."""
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    app_env: Literal["dev", "test", "prod"] = "dev"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    if settings.app_env == "prod" and settings.jwt_secret == _DEV_JWT_SECRET:
        raise RuntimeError(
            "JWT_SECRET must be set to a non-default value when APP_ENV=prod"
        )
    return settings
```

- [ ] **Step 3: Verify settings load**

Run:
```bash
(cd backend && uv run python -c "from backend.config import get_settings; s = get_settings(); print(s.app_env, s.jwt_ttl_seconds)")
```

Expected: `dev 86400`.

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example backend/src/backend/config.py
git commit -m "$(cat <<'EOF'
phase5: add Settings (pydantic-settings) and .env.example

DATABASE_URL, JWT_SECRET/TTL, CORS origins, APP_ENV. Cached via
get_settings(); consumed by the FastAPI app factory and DB engine.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task A4: `server.py` factory + `/health` router

**Files:**
- Create: `backend/src/backend/server.py`
- Create: `backend/src/backend/routers/__init__.py`
- Create: `backend/src/backend/routers/health.py`

- [ ] **Step 1: Write `routers/__init__.py` (empty re-export hub)**

```python
"""FastAPI routers. Each module exports a module-level `router` which
`backend.server.create_app()` mounts."""
```

- [ ] **Step 2: Write `routers/health.py`**

```python
"""Unauthenticated liveness probe. Not under /api/v1 — deployment
load balancers typically hit /health at the root."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health", tags=["internal"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 3: Write `server.py`**

```python
"""FastAPI application factory.

`create_app()` builds and returns a fully-wired FastAPI instance.
A module-level `app` is exported for `fastapi-cli` (see
`[tool.fastapi] entrypoint` in pyproject.toml).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.routers import health


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Golden Abundance API",
        version="0.1.0",
        description="Phase 5 backend — see backend/src/backend/contract/endpoints.md",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    return app


app = create_app()
```

- [ ] **Step 4: Boot the server manually to sanity-check**

Run:
```bash
(cd backend && uv run fastapi dev src/backend/server.py --port 8001) &
sleep 3
curl -s http://localhost:8001/health
kill %1
```

Expected: `{"status":"ok"}`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/server.py backend/src/backend/routers/__init__.py backend/src/backend/routers/health.py
git commit -m "$(cat <<'EOF'
phase5: add FastAPI app factory and /health router

create_app() wires CORS from Settings and mounts /health. Module-level
app matches the existing [tool.fastapi] entrypoint in pyproject.toml
so `fastapi dev` / `fastapi run` work without explicit paths.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task A5: First test — `/health` via `TestClient`

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py` (minimal, DB fixtures added in Section B)
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: Create `backend/tests/__init__.py`** (empty file)

```bash
mkdir -p backend/tests && touch backend/tests/__init__.py
```

- [ ] **Step 2: Write a minimal `conftest.py`**

This is a stub that Section B will expand with DB/container fixtures. For Section A we only need the FastAPI `TestClient`.

```python
"""Shared pytest fixtures. Section B adds DB/container fixtures."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from backend.server import create_app


@pytest.fixture
def no_db_client() -> Iterator[TestClient]:
    """Sync TestClient without DB — for routes that don't touch the database."""
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app()
    with TestClient(app) as c:
        yield c
```

- [ ] **Step 3: Write `tests/test_health.py`**

Use the `no_db_client` fixture so `/health` tests do not drag in the testcontainer dependency that Section B adds to the `client` fixture (saves ~30s per run).

```python
from fastapi.testclient import TestClient


def test_health_ok(no_db_client: TestClient) -> None:
    response = no_db_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body.get("status") == "ok"
```

- [ ] **Step 4: Run it**

Run:
```bash
(cd backend && uv run pytest tests/test_health.py -v)
```

Expected: 1 passed. Coverage report prints but does not fail yet (see A6).

- [ ] **Step 5: Commit**

```bash
git add backend/tests/__init__.py backend/tests/conftest.py backend/tests/test_health.py
git commit -m "$(cat <<'EOF'
phase5: add first test — /health via TestClient

Minimal conftest with a TestClient fixture over create_app(). DB and
container fixtures land in Section B.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task A5b: `Settings` validation tests

**Files:**
- Create: `backend/tests/test_config.py`

Covers the three `config.py` safeguards: the prod-env JWT secret check, the `min_length=32` field constraint, and the comma-separated `CORS_ORIGINS` parser. Each test clears `get_settings.cache_clear()` so later tests never observe mutated env.

- [ ] **Step 1: Write `backend/tests/test_config.py`**

```python
"""Tests for backend.config — the `Settings` class and its safeguards."""

from __future__ import annotations

import pytest

from backend.config import _DEV_JWT_SECRET, Settings, get_settings


def test_prod_with_default_secret_refuses_to_load(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("JWT_SECRET", _DEV_JWT_SECRET)
    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        get_settings()
    get_settings.cache_clear()


def test_prod_with_real_secret_loads(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("JWT_SECRET", "a-real-long-secret-from-a-vault-32-plus")
    get_settings.cache_clear()
    s = get_settings()
    assert s.app_env == "prod"
    get_settings.cache_clear()


def test_short_secret_rejected_by_pydantic(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "short")
    get_settings.cache_clear()
    with pytest.raises(Exception):  # pydantic ValidationError
        Settings()
    get_settings.cache_clear()


def test_cors_origins_parses_comma_separated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://a.example,http://b.example")
    get_settings.cache_clear()
    s = get_settings()
    assert s.cors_origins == ["http://a.example", "http://b.example"]
    get_settings.cache_clear()
```

- [ ] **Step 2: Run the new test file**

```bash
(cd backend && uv run pytest tests/test_config.py -v)
```

Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_config.py
git commit -m "$(cat <<'EOF'
phase5: add Settings validation tests

Covers the prod-env JWT secret guard, the min_length=32 field
constraint, and the comma-separated CORS_ORIGINS parser. Each test
clears get_settings.cache_clear() so later tests never observe
mutated env state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task A6: `backend/justfile` — add `dev`, `db-up`, `db-down`, `test`; re-add `test` to `ci`

**Files:**
- Modify: `backend/justfile`

- [ ] **Step 1: Replace `backend/justfile` with the expanded recipe set**

Current contents (two recipes: `ci`, `contract-validate`). New contents:

```justfile
# Run full CI (lint, format, typecheck, contract fixtures, tests).
ci:
  uv sync --all-extras --dev
  uv run ruff check --fix
  uv run ruff format
  uv run ty check
  uv run python -m backend.contract.validate_examples
  uv run pytest

# Validate example JSON fixtures against the Pydantic contract models
contract-validate:
  uv run python -m backend.contract.validate_examples

# Run the FastAPI dev server on http://localhost:8000 with reload
dev port="8000":
  uv run fastapi dev src/backend/server.py --port {{port}}

# Start local Postgres (docker compose)
db-up:
  docker compose up -d --wait

# Stop local Postgres
db-down:
  docker compose down

# Run pytest only
test *args:
  uv run pytest {{args}}
```

- [ ] **Step 2: Run `just -f backend/justfile test`**

Run:
```bash
just -f backend/justfile test
```

Expected: 1 passed. (Coverage may warn about `fail_under=90` — that's fine for now; will stabilize by end of Phase 5.)

- [ ] **Step 3: Run `just -f backend/justfile dev` briefly**

```bash
just -f backend/justfile dev 8001 &
sleep 3
curl -s http://localhost:8001/health
kill %1
```

Expected: `{"status":"ok"}`.

- [ ] **Step 4: Commit**

```bash
git add backend/justfile
git commit -m "$(cat <<'EOF'
phase5: add dev, db-up, db-down, test recipes; re-add pytest to ci

just dev — fastapi dev
just db-up / db-down — docker compose lifecycle
just test [args] — passthrough to pytest
ci now runs contract-validate then pytest after ruff + ty (Phase 5
restores pytest per launch plan and guards against example-fixture
drift in the same step).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Section B — Database, SQLModel tables, Alembic

**Exit criteria:** All persistence tables exist in the DB via a single Alembic `head` revision; a session fixture backed by testcontainers-postgres is available to subsequent tests; one round-trip test inserts and reads a `UserRow`.

### Task B1: Async engine + session factory

**Files:**
- Create: `backend/src/backend/db/__init__.py`
- Create: `backend/src/backend/db/engine.py`
- Create: `backend/src/backend/db/session.py`

- [ ] **Step 1: Write `db/__init__.py`**

```python
"""DB layer: async engine, session factory, SQLModel tables.

Tables are the persistence shape. The wire-format contract lives in
`backend.contract`; services translate between the two.
"""

from backend.db.engine import get_engine, get_session_maker, reset_engine
from backend.db.session import get_session

__all__ = ["get_engine", "get_session", "get_session_maker", "reset_engine"]
```

- [ ] **Step 2: Write `db/engine.py`**

```python
"""Async SQLAlchemy engine + session factory.

Engine and sessionmaker are built lazily inside ``get_engine()`` /
``get_session_maker()``. This lets test harnesses swap ``DATABASE_URL``
(or install a pre-built engine via ``reset_engine()``) before any code
opens a session — no module-import ordering hazard.

App code should prefer the getters::

    from backend.db.engine import get_session_maker
    async with get_session_maker()() as session: ...

The legacy module attributes ``engine`` and ``AsyncSessionLocal`` are
still accessible for ergonomics; both resolve through the same lazy
singletons via ``__getattr__``.
"""

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.config import get_settings

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            get_settings().database_url,
            echo=False,
            future=True,
            pool_pre_ping=True,
        )
    return _engine


def get_session_maker() -> async_sessionmaker[AsyncSession]:
    global _sessionmaker
    if _sessionmaker is None:
        _sessionmaker = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _sessionmaker


def reset_engine(engine: AsyncEngine) -> None:
    """Install a pre-built engine and rebuild the sessionmaker against it.

    Used by the pytest harness to pin the engine to a testcontainer.
    Call BEFORE any code opens a session; sessions produced by the
    previous sessionmaker keep their binding to the previous engine.
    """
    global _engine, _sessionmaker
    _engine = engine
    _sessionmaker = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )


def __getattr__(name: str):  # pragma: no cover - trivial lazy loader
    if name == "engine":
        return get_engine()
    if name == "AsyncSessionLocal":
        return get_session_maker()
    raise AttributeError(f"module 'backend.db.engine' has no attribute {name!r}")
```

- [ ] **Step 3: Write `db/session.py`**

```python
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
```

- [ ] **Step 4: Verify imports**

```bash
(cd backend && uv run python -c "from backend.db.engine import get_engine, get_session_maker, reset_engine; from backend.db.session import get_session; print('ok')")
```

Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/db/__init__.py backend/src/backend/db/engine.py backend/src/backend/db/session.py
git commit -m "$(cat <<'EOF'
phase5: add async SQLAlchemy engine, session factory, and dep

Engine/sessionmaker build lazily on first get_engine() / get_session_maker()
call; reset_engine() swaps both in-place (used by the pytest harness).
AsyncSession uses expire_on_commit=False so services can return ORM
objects without re-fetching after commit. DATABASE_URL is read at
resolution time, not import time — tests can override before the first
session opens.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task B2: SQLModel tables — `db/models.py`

All tables in one module for easy `metadata` imports (Alembic, `create_all`). Naming convention: `<Domain>Row` class → `<domain>_table` table name in snake_case plural.

**Files:**
- Create: `backend/src/backend/db/models.py`

- [ ] **Step 1: Write `backend/src/backend/db/models.py`**

```python
"""SQLModel persistence tables.

Every table has a UUID primary key (random v4 by default) and a
``created_at`` column with UTC default. Nothing here is re-exported from
``backend.contract`` — these shapes are internal to the backend.

Enum-like string columns: every ``Literal[...]`` field declares an
explicit ``sa_column=Column(String(16), ...)`` so both
``metadata.create_all`` (tests) and Alembic autogenerate (migrations)
emit VARCHAR. SQLModel's implicit handling of ``Literal`` has varied
across versions; the explicit column eliminates the ambiguity and
lets values grow without PG enum surgery.
"""

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, DateTime, String, UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRow(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    display_id: str = Field(index=True, unique=True, max_length=16)
    email: str = Field(index=True, unique=True, max_length=320)
    zh_name: str | None = None
    en_name: str | None = None
    nickname: str | None = None
    phone: str | None = None
    phone_code: str | None = None
    line_id: str | None = None
    telegram_id: str | None = None
    country: str | None = None
    location: str | None = None
    avatar_url: str | None = None
    profile_complete: bool = Field(default=False)
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    )


class TeamRow(SQLModel, table=True):
    __tablename__ = "teams"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    display_id: str = Field(index=True, unique=True, max_length=16)
    name: str
    alias: str | None = None
    topic: str = Field(default="尚未指定主題")
    leader_id: UUID = Field(foreign_key="users.id", index=True, unique=True)
    cap: int = Field(default=6, ge=1)
    points: int = Field(default=0, ge=0)
    week_points: int = Field(default=0, ge=0)
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    )


class TeamMembershipRow(SQLModel, table=True):
    __tablename__ = "team_memberships"
    __table_args__ = (UniqueConstraint("user_id", name="uq_membership_user"),)

    team_id: UUID = Field(foreign_key="teams.id", primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", primary_key=True)
    joined_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    )


class JoinRequestRow(SQLModel, table=True):
    __tablename__ = "join_requests"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    team_id: UUID = Field(foreign_key="teams.id", index=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    status: Literal["pending", "approved", "rejected"] = Field(
        default="pending",
        sa_column=Column(String(16), nullable=False, default="pending"),
    )
    requested_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    )


class TaskDefRow(SQLModel, table=True):
    __tablename__ = "task_defs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    display_id: str = Field(index=True, unique=True, max_length=16)
    title: str
    summary: str
    description: str
    tag: Literal["探索", "社区", "陪伴"] = Field(
        sa_column=Column(String(16), nullable=False)
    )
    color: str
    points: int = Field(ge=0)
    bonus: str | None = None
    due_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    est_minutes: int = Field(ge=0)
    is_challenge: bool = Field(default=False)
    cap: int | None = None
    form_type: Literal["interest", "ticket"] | None = Field(
        default=None,
        sa_column=Column(String(16), nullable=True),
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    )


class TaskDefRequiresRow(SQLModel, table=True):
    """Task-def → prerequisite task-def (many-to-many self-link)."""

    __tablename__ = "task_def_requires"

    task_def_id: UUID = Field(foreign_key="task_defs.id", primary_key=True)
    requires_id: UUID = Field(foreign_key="task_defs.id", primary_key=True)


class TaskStepDefRow(SQLModel, table=True):
    __tablename__ = "task_step_defs"
    __table_args__ = (UniqueConstraint("task_def_id", "order", name="uq_step_order"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    task_def_id: UUID = Field(foreign_key="task_defs.id", index=True)
    label: str
    order: int = Field(ge=0)


class TaskProgressRow(SQLModel, table=True):
    __tablename__ = "task_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "task_def_id", name="uq_progress_user_task"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    task_def_id: UUID = Field(foreign_key="task_defs.id", index=True)
    status: Literal["todo", "in_progress", "completed"] = Field(
        default="todo",
        sa_column=Column(String(16), nullable=False, default="todo"),
    )
    progress: float | None = Field(default=None, ge=0.0, le=1.0)
    form_submission: dict | None = Field(
        default=None, sa_column=Column(JSON, nullable=True)
    )
    completed_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    updated_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    )


class TaskStepProgressRow(SQLModel, table=True):
    __tablename__ = "task_step_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "step_id", name="uq_step_progress_user_step"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    step_id: UUID = Field(foreign_key="task_step_defs.id", index=True)
    done: bool = Field(default=False)


class RewardRow(SQLModel, table=True):
    __tablename__ = "rewards"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    task_def_id: UUID = Field(foreign_key="task_defs.id", index=True)
    task_title: str
    bonus: str
    status: Literal["earned", "claimed"] = Field(
        default="earned",
        sa_column=Column(String(16), nullable=False, default="earned"),
    )
    earned_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    )
    claimed_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class NewsItemRow(SQLModel, table=True):
    __tablename__ = "news_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str
    body: str
    category: Literal["公告", "活動", "通知"] = Field(
        sa_column=Column(String(16), nullable=False)
    )
    image_url: str | None = None
    published_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    )
    pinned: bool = Field(default=False, index=True)
```

**Why these shapes map to the contract:**

- `User.name` is **derived** in the service layer (`zh_name` → `nickname` → email-local-part) and is NOT stored.
- `Task.status`/`progress`/`steps`/`team_progress` are merged views — the DB stores only the per-user state pieces (`TaskProgressRow`, `TaskStepProgressRow`) and global definitions (`TaskDefRow`, `TaskStepDefRow`, `TaskDefRequiresRow`); the service layer derives `locked`/`expired`/`team_progress` per caller.
- `Team.role` and `Team.requests` are caller-scoped: the service layer populates them based on the current user's relationship to the team.
- `Reward.bonus` is non-null (persisted verbatim from `TaskDef.bonus` at earn time); rewardless tasks simply never create a `RewardRow`.

- [ ] **Step 2: Verify model metadata is well-formed**

```bash
(cd backend && uv run python -c "from backend.db.models import SQLModel; print(sorted(t.name for t in SQLModel.metadata.sorted_tables))")
```

Expected: a sorted list of the 11 table names (`join_requests`, `news_items`, `rewards`, `task_def_requires`, `task_defs`, `task_progress`, `task_step_defs`, `task_step_progress`, `team_memberships`, `teams`, `users`).

- [ ] **Step 3: Commit**

```bash
git add backend/src/backend/db/models.py
git commit -m "$(cat <<'EOF'
phase5: add SQLModel tables for users, teams, tasks, rewards, news

Persistence shape only; contract Pydantic models remain the wire format
and are derived in the service layer. UUID PKs, timezone-aware
timestamps, JOIN table for task requires, JSON column for form
submissions, unique constraints for single-team / single-progress
invariants. Every Literal column declares an explicit String(16)
sa_column so create_all and Alembic both emit VARCHAR, not PG enum.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task B3: Alembic init + async `env.py` + initial migration

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/0001_initial.py`

- [ ] **Step 1: Bootstrap alembic directory structure (without running `alembic init`)**

We hand-write rather than run `alembic init async` because the template's wording is spartan and we want a concise, opinionated `env.py`.

```bash
mkdir -p backend/alembic/versions
```

- [ ] **Step 2: Write `backend/alembic.ini`**

```ini
[alembic]
script_location = alembic
prepend_sys_path = src
sqlalchemy.url = driver://user:pass@host/db
; Actual URL comes from env in alembic/env.py.

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 3: Write `backend/alembic/env.py`** (async aware)

```python
"""Alembic environment — async, reads DATABASE_URL from Settings.

Usage:
    (cd backend && uv run alembic upgrade head)
    (cd backend && uv run alembic revision --autogenerate -m "msg")
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlmodel import SQLModel

from backend.config import get_settings
from backend.db import models as _models  # noqa: F401 — populates metadata

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_settings().database_url)
target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        future=True,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

- [ ] **Step 4: Write `backend/alembic/script.py.mako`** (standard Alembic template)

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 5: Start Postgres and autogenerate the initial migration**

```bash
just -f backend/justfile db-up
(cd backend && uv run alembic revision --autogenerate -m "initial schema" --rev-id 0001)
```

Expected: creates `backend/alembic/versions/0001_initial_schema.py` with `op.create_table(...)` calls for all 11 tables.

- [ ] **Step 6: Rename to a stable filename**

```bash
mv backend/alembic/versions/0001_initial_schema.py backend/alembic/versions/0001_initial.py
```

- [ ] **Step 7: Inspect the generated file**

Read `backend/alembic/versions/0001_initial.py`. Confirm it creates: `users`, `teams`, `team_memberships`, `join_requests`, `task_defs`, `task_def_requires`, `task_step_defs`, `task_progress`, `task_step_progress`, `rewards`, `news_items`. Confirm the enum-like columns (`join_requests.status`, `task_defs.tag`, `task_defs.form_type`, `task_progress.status`, `rewards.status`, `news_items.category`) are emitted as `sa.String(length=16)` — `db/models.py` declares them with an explicit `sa_column=Column(String(16), ...)` so autogenerate should not produce `sa.Enum`. If it does anyway (SQLModel/SQLAlchemy version skew), replace `sa.Enum(...)` with `sa.String(length=16)` in the generated file and drop any `postgresql.ENUM` definitions — keeping models and migration both on VARCHAR avoids PG-enum value-migration pain later.

- [ ] **Step 8: Apply migration**

```bash
(cd backend && uv run alembic upgrade head)
```

Expected: log line `Running upgrade  -> 0001, initial schema`. Tables exist in the running `app` database.

- [ ] **Step 9: Verify tables exist**

```bash
(cd backend && uv run python -c "
import asyncio
from sqlalchemy import text
from backend.db.engine import get_engine
async def main():
    async with get_engine().connect() as c:
        rows = await c.execute(text(\"SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename\"))
        for r in rows: print(r[0])
asyncio.run(main())
")
```

Expected output includes: `alembic_version`, `join_requests`, `news_items`, `rewards`, `task_def_requires`, `task_defs`, `task_progress`, `task_step_defs`, `task_step_progress`, `team_memberships`, `teams`, `users`.

- [ ] **Step 10: Commit**

```bash
git add backend/alembic.ini backend/alembic/env.py backend/alembic/script.py.mako backend/alembic/versions/0001_initial.py
git commit -m "$(cat <<'EOF'
phase5: add Alembic async env and initial schema migration

alembic/env.py reads DATABASE_URL from Settings and runs migrations
against the async engine. 0001_initial.py creates all 11 tables.
Literal columns persist as VARCHAR (not PG enums) for easier future
value additions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 11: Add `migrate` recipe to `backend/justfile`**

Insert after the `db-down` recipe:

```justfile

# Run Alembic migrations to head
migrate:
  uv run alembic upgrade head

# Create a new Alembic revision (pass MSG="message")
makemigration MSG:
  uv run alembic revision --autogenerate -m "{{MSG}}"
```

- [ ] **Step 12: Commit**

```bash
git add backend/justfile
git commit -m "$(cat <<'EOF'
phase5: add just migrate / makemigration recipes

just migrate — alembic upgrade head
just makemigration MSG="..." — alembic revision --autogenerate

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task B4: Test harness — testcontainers-postgres + per-test TRUNCATE

**Files:**
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Expand `backend/tests/conftest.py`**

Replace the Section-A minimal conftest with:

```python
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
from collections.abc import AsyncIterator, Iterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlmodel import SQLModel
from testcontainers.postgres import PostgresContainer

from backend.db import models as _models  # noqa: F401 — populates metadata
from backend.db.engine import get_session_maker, reset_engine
from backend.db.session import get_session
from backend.server import create_app


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

    cfg = Config("backend/alembic.ini")
    cfg.set_main_option("script_location", "backend/alembic")
    command.upgrade(cfg, "head")


@pytest_asyncio.fixture(scope="session")
async def engine(postgres_container: PostgresContainer) -> AsyncIterator:
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
            await conn.execute(
                text(f'TRUNCATE TABLE "{table.name}" RESTART IDENTITY CASCADE')
            )


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    app = create_app()

    async def _override_get_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = _override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
```

Note: the Section A `client` fixture (sync `TestClient` over fresh `create_app`) is replaced for DB-backed tests. The only Section A test (`test_health.py`) does not need the DB, so it keeps using the `no_db_client` fixture introduced in A5 — which is now also defined in the expanded `conftest.py` above (Step 1). Confirm the current `test_health.py` still looks like:

- [ ] **Step 2: Confirm `backend/tests/test_health.py` uses `no_db_client`**

```python
from fastapi.testclient import TestClient


def test_health_ok(no_db_client: TestClient) -> None:
    response = no_db_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body.get("status") == "ok"
```

This avoids the ~30s testcontainer startup for a route that never touches the database.

- [ ] **Step 3: Write a DB round-trip test — `backend/tests/test_db_roundtrip.py`**

```python
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import UserRow


async def test_insert_and_read_user(session: AsyncSession) -> None:
    user = UserRow(
        display_id="UTEST1",
        email="roundtrip@example.com",
        profile_complete=False,
    )
    session.add(user)
    await session.commit()

    result = await session.execute(select(UserRow).where(UserRow.email == "roundtrip@example.com"))
    fetched = result.scalar_one()
    assert fetched.display_id == "UTEST1"
    assert fetched.profile_complete is False
```

- [ ] **Step 4: Run tests**

```bash
just -f backend/justfile test
```

Expected: 2 passed. Container is pulled on first run (may take a minute); subsequent runs are fast.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/conftest.py backend/tests/test_health.py backend/tests/test_db_roundtrip.py
git commit -m "$(cat <<'EOF'
phase5: wire testcontainers Postgres + per-test TRUNCATE

Session-scoped postgres:17-alpine via testcontainers; `alembic upgrade
head` runs against the container on session start (not
metadata.create_all) so tests exercise the same schema production
deploys will have — schema drift between db/models.py and the
migration files fails CI instead of hiding. TRUNCATE ... CASCADE
between tests. A single reset_engine() call aligns get_session_maker()
with the container engine. httpx.AsyncClient over ASGITransport
replaces TestClient so endpoint tests can be async end-to-end.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task B5: Schema-drift regression tests

**Files:**
- Create: `backend/tests/test_schema.py`

Two tests guard against two distinct drift modes:
1. The set of tables that Alembic produces matches the set of tables `db/models.py` declares.
2. `Literal[...]` columns persist as `VARCHAR(16)`, not PG enums — a future `alembic revision --autogenerate` that silently emits `sa.Enum(...)` would make subsequent migrations that add new Literal values break (PG enums cannot be altered in-place without surgery).

- [ ] **Step 1: Write `backend/tests/test_schema.py`**

```python
"""Schema-drift regression tests — ensure Alembic migration output matches models.

Phase 5a uses SQLAlchemy `String(16)` (not PG enums) for all `Literal[...]`
fields. A future `alembic revision --autogenerate` must preserve this to avoid
breaking migrations that try to alter a VARCHAR into a PG enum in-place.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import SQLModel


async def test_migration_produces_every_model_table(engine: AsyncEngine) -> None:
    expected = {t.name for t in SQLModel.metadata.sorted_tables}
    async with engine.connect() as c:
        rows = await c.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname='public'")
        )
        actual = {r[0] for r in rows}
    missing = expected - actual
    assert not missing, f"Migration missing tables: {missing}"


async def test_literal_columns_persist_as_varchar_16(engine: AsyncEngine) -> None:
    """Guard against a future autogenerate emitting `sa.Enum` for Literal fields."""
    async with engine.connect() as c:
        rows = (await c.execute(text(
            """
            SELECT table_name, column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema='public'
              AND column_name IN ('status', 'tag', 'form_type', 'category')
            ORDER BY table_name, column_name
            """
        ))).all()
    assert rows, "Expected at least one Literal-backed column"
    for tbl, col, dtype, maxlen in rows:
        assert dtype == "character varying", f"{tbl}.{col} is {dtype}, want varchar"
        assert maxlen == 16, f"{tbl}.{col} maxlen={maxlen}, want 16"


def test_migration_is_downgrade_safe() -> None:
    """`upgrade head → downgrade base → upgrade head` must round-trip cleanly.

    Catches asymmetric migrations where a column/table was added to `upgrade()`
    but the corresponding `drop` was forgotten in `downgrade()`. Runs in an
    isolated short-lived container so it can't disturb the session-scoped
    fixture that other tests share.
    """
    import os
    from alembic import command
    from alembic.config import Config
    from testcontainers.postgres import PostgresContainer

    alembic_ini = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
    )
    with PostgresContainer("postgres:17-alpine") as pg:
        cfg = Config(alembic_ini)
        cfg.set_main_option("sqlalchemy.url", pg.get_connection_url())
        command.upgrade(cfg, "head")
        command.downgrade(cfg, "base")
        command.upgrade(cfg, "head")
```

- [ ] **Step 2: Run the new test file**

```bash
(cd backend && uv run pytest tests/test_schema.py -v)
```

Expected: 3 passed. (The downgrade-safety test spins its own container — ~15s extra on first run.)

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_schema.py
git commit -m "$(cat <<'EOF'
phase5: add schema-drift regression tests

Two guards against the most likely drift modes between db/models.py
and the migration history: missing tables after autogenerate, and
Literal[...] columns silently flipping from VARCHAR to sa.Enum — the
latter would make any future Literal-value additions require PG enum
surgery.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist

**Spec coverage — this plan lays the foundation; no contract endpoints ship here yet. `/health` is the only route live after this plan merges (internal, not part of the contract).**

**Placeholder scan:** No `TBD` / `implement later` / "similar to task N" / "add error handling" / "write tests for the above" placeholders remain. Every code step ships complete, runnable code.

**Type consistency:**
- `get_session` FastAPI dependency yields an `AsyncSession` (defined in `db/session.py`; used by every router created in later plans).
- `reset_engine()` is the only supported way tests swap the engine — the harness in `conftest.py` calls it once, session-scoped.

**Known gaps surfaced during plan writing (documented, not blocking):**

- Alembic autogenerate occasionally renders `Literal` columns as `sa.Enum(...)` under some SQLModel/SQLAlchemy version combinations. Task B3 Step 7 calls this out — hand-edit the generated file to `sa.String(length=16)` if you see it. Task B5's `test_literal_columns_persist_as_varchar_16` catches any regression on subsequent autogenerate runs.
- The `client` fixture rebuilds `create_app()` per test, which means any test that mutates settings via `monkeypatch.setenv(...)` MUST also call `get_settings.cache_clear()` before asserting — otherwise the app it builds will still observe the pre-mutation cached `Settings`. `tests/test_config.py` follows this pattern and resets the cache at the end of each test so it never bleeds into a sibling test.
- `alembic/env.py` runs `asyncio.run(run_migrations_online())` at import time. `conftest.py` hops to a worker thread (`asyncio.to_thread(_alembic_upgrade_head, ...)`) so this doesn't collide with pytest-asyncio's own loop — but a cleaner long-term fix is to switch `env.py` to a sync Alembic invocation that borrows a sync connection from the async engine (`engine.sync_engine`). TODO tracked for Phase 5b+ when auth work starts layering additional startup code.

**Resolved during review (previously flagged as gaps):**

- ✅ **Schema parity with Alembic.** `conftest.py` runs `alembic upgrade head` against the testcontainer before tests run, so tests exercise the deployed schema. Drift between `db/models.py` and the migration files fails CI.
- ✅ **Literal columns are unambiguously VARCHAR.** Every `Literal[...]` field in `db/models.py` declares `sa_column=Column(String(16), ...)`, so both `create_all` and autogenerate emit `sa.String(length=16)` — no PG enum surprise.
- ✅ **JWT secret prod safeguard.** `get_settings()` raises if `APP_ENV=prod` and `JWT_SECRET` is still the dev default, so a deploy that forgets to set it fails fast. (The JWT code itself lands in 5b; the settings guard lives here.)
- ✅ **Engine init is lazy.** `backend.db.engine` exposes `get_engine()` / `get_session_maker()` / `reset_engine()`; conftest rebinds cleanly via `reset_engine()` instead of reaching into module attrs.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-19-phase-5a-foundation.md`.**

The plan lives in the main repo so it's visible across worktrees. Before executing, create a worktree under `.worktree/phase-5a-foundation` (per user's global instruction) so Phase-5a work stays isolated.

Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task with a two-stage review between them. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks sequentially in the current session with batch checkpoints. Use `superpowers:executing-plans`. Faster wall-clock, but the main session's context fills up quickly.

**After 5a merges, proceed to phase-5b-auth.**

**Which approach would you like?**
