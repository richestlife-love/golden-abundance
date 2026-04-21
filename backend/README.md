# Backend

FastAPI + SQLModel + Alembic + Postgres 17. See the [root README](../README.md) for prerequisites, recipe tables, and typical workflows.

## Layout

- `src/backend/server.py` — FastAPI factory. Mounts routers at `/api/v1` and `/health`.
- `src/backend/config.py` — pydantic-settings `Settings`; process-wide cached via `get_settings()`.
- `src/backend/routers/` — route handlers (`health`, `leaderboard`, `me`, `news`, `tasks`, `teams`). Auth is a FastAPI dependency, not a router — identity is issued by Supabase.
- `src/backend/services/` — pure business logic (`display_id`, `leaderboard`, `news`, `pagination`, `reward`, `task`, `team`, `team_join`, `user`); routers call services, services call `db`.
- `src/backend/db/` — `engine.py` (cached async engine + sessionmaker), `session.py` (FastAPI dependency), `models.py` (SQLModel tables).
- `src/backend/contract/` — Pydantic 2 wire-format models shared with the frontend. See [`contract/README.md`](src/backend/contract/README.md).
- `src/backend/auth/` — Supabase JWKS-based RS256 JWT verifier (`supabase.py`) + `current_user` FastAPI dependency that upserts a `UserRow` on first sight of a `sub`. OAuth flow is owned by the frontend's Supabase SDK; the backend only verifies incoming `Authorization: Bearer` tokens.
- `src/backend/seed.py` / `seed_reset.py` — idempotent / destructive seed entrypoints behind `just backend seed` and `just backend seed-reset`.
- `alembic/` — Alembic environment (`env.py`) and revision scripts (`versions/`).
- `tests/` — pytest (async). Mirrors `src/backend/` layout (`routers/`, `services/`, `auth/`, `db/`).

## Configuration

Runtime config is read from the environment (prefer a `.env` file; see `.env.example` for the dev defaults):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy URL with psycopg3 async driver. Defaults to the local `docker compose` Postgres. |
| `SUPABASE_URL` | Supabase project base URL (e.g. `https://<ref>.supabase.co`). Required when `APP_ENV=prod` — `get_settings()` **refuses to boot a prod app** without it. The JWKS endpoint (`…/auth/v1/.well-known/jwks.json`) and issuer claim are derived from this. Optional in dev/test. |
| `SUPABASE_JWT_AUD` | Audience claim enforced on incoming JWTs. Defaults to Supabase's `"authenticated"`. |
| `CORS_ORIGINS` | Comma-separated (or JSON array) list of allowed origins. |
| `APP_ENV` | One of `dev`, `test`, `prod`. Drives boot-safety checks and guards destructive recipes (e.g. `seed-reset`). |
| `SENTRY_DSN` | Sentry DSN for backend error reporting. Optional — `sentry_sdk.init()` is skipped when absent, so local dev and test runs are free of Sentry traffic. |
| `APP_RELEASE` | Release tag sent to Sentry alongside error events. Railway injects this as `${{RAILWAY_GIT_COMMIT_SHA}}`; optional in dev. |

`get_settings()` is cached with `lru_cache(1)`; tests reset the cache via an autouse fixture so `monkeypatch.setenv` keeps working.

## Database & migrations

- Local Postgres is a single-container `docker compose` (`docker-compose.yml`) exposing `localhost:5432` with `app/app/app` user/password/db.
- Alembic reads `DATABASE_URL` from `Settings` (`alembic/env.py`), not from `alembic.ini`. Autogenerate runs with `compare_type=True` so column-type changes (e.g. VARCHAR length) aren't silently ignored.
- `just backend makemigration MSG="..."` autogenerates a revision. **Review the generated script before committing** — autogenerate doesn't catch every drift (check constraints, server defaults, table renames).
- `just backend migrate` runs `alembic upgrade head`.

## Seed

- `backend.seed` populates task definitions and news items. Idempotent but **skip-on-conflict** — existing rows are not updated, so use `seed-reset` after changing seed content.
- `backend.seed_reset` truncates seed-owned tables then re-seeds. Refuses `APP_ENV=prod`.
- Demo users (`DEMO_USERS` in `backend/seed.py`) use stable `UUID(int=i)` identities so the test fixtures' `mint_access_token` helper can mint JWTs that match seeded rows. Dev-only; the prod seed skips `DEMO_USERS`. Real Supabase identities materialize at first sign-in via `upsert_user_by_supabase_identity`.

## Contract

All request/response shapes shared with the frontend live in `src/backend/contract/`. Example JSON fixtures under `contract/examples/` are validated against their Pydantic models by `just backend contract-validate` (also part of `just backend ci`). See [`contract/README.md`](src/backend/contract/README.md) for the endpoint catalog, module map, and usage patterns (`SubmitBody` discriminated union, `Paginated[T]`).

## Tests

- pytest with `pytest-asyncio` (`asyncio_mode = auto`). Coverage floor is 90% (`pyproject.toml`, `source = ["src"]`).
- Tests run against a **real Postgres** (`testcontainers`), not SQLite. Migrations are applied to the container once per session — `SQLModel.metadata.create_all` would silently paper over drift between `db/models.py` and the migration files.
- Each test gets a fresh `AsyncSession` and every table is `TRUNCATE`d after, so tests stay isolated without per-test containers.
- `tests/conftest.py` exposes the main fixtures:
  - `session` — `AsyncSession` bound to the shared engine.
  - `client` — `httpx.AsyncClient` with the app's `get_session` dependency overridden to the test session.
  - `no_db_client` — sync `TestClient` for DB-free routes.
  - `seeded_task_defs` — the four prototype tasks (T1–T4) pre-inserted.
- `tests/` mirrors `src/backend/` so tests live alongside the module they cover.
