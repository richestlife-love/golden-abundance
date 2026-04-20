# Backend

FastAPI + SQLModel + Alembic + Postgres 17. See the [root README](../README.md) for prerequisites, recipe tables, and typical workflows.

## Layout

- `src/backend/server.py` — FastAPI factory. Mounts routers at `/api/v1` and `/health`.
- `src/backend/config.py` — pydantic-settings `Settings`; process-wide cached via `get_settings()`.
- `src/backend/routers/` — route handlers (`auth`, `health`, `me`, `news`, `rank`, `tasks`, `teams`).
- `src/backend/services/` — pure business logic (`display_id`, `news`, `pagination`, `rank`, `reward`, `task`, `team`, `team_join`, `user`); routers call services, services call `db`.
- `src/backend/db/` — `engine.py` (cached async engine + sessionmaker), `session.py` (FastAPI dependency), `models.py` (SQLModel tables).
- `src/backend/contract/` — Pydantic 2 wire-format models shared with the frontend. See [`contract/README.md`](src/backend/contract/README.md).
- `src/backend/auth/` — JWT encode/decode, FastAPI auth dependencies, Google OIDC stub.
- `src/backend/seed.py` / `seed_reset.py` — idempotent / destructive seed entrypoints behind `just backend seed` and `just backend seed-reset`.
- `src/backend/scripts/dump_demo_accounts.py` — prints `DEMO_USERS` as JSON; consumed by `just gen-demo-accounts` at the repo root.
- `alembic/` — Alembic environment (`env.py`) and revision scripts (`versions/`).
- `tests/` — pytest (async). Mirrors `src/backend/` layout (`routers/`, `services/`, `auth/`, `db/`).

## Configuration

Runtime config is read from the environment (prefer a `.env` file; see `.env.example` for the dev defaults):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy URL with psycopg3 async driver. Defaults to the local `docker compose` Postgres. |
| `JWT_SECRET` | HMAC secret for access-token signing. Minimum 32 chars. The dev default is **refused at boot when `APP_ENV=prod`** — deploys that forget to set it fail fast. |
| `JWT_TTL_SECONDS` | Access-token lifetime in seconds. Defaults to `86400`. |
| `CORS_ORIGINS` | Comma-separated (or JSON array) list of allowed origins. |
| `APP_ENV` | One of `dev`, `test`, `prod`. Drives boot-safety checks and guards destructive recipes (e.g. `seed-reset`). |

`get_settings()` is cached with `lru_cache(1)`; tests reset the cache via an autouse fixture so `monkeypatch.setenv` keeps working.

## Database & migrations

- Local Postgres is a single-container `docker compose` (`docker-compose.yml`) exposing `localhost:5432` with `app/app/app` user/password/db.
- Alembic reads `DATABASE_URL` from `Settings` (`alembic/env.py`), not from `alembic.ini`. Autogenerate runs with `compare_type=True` so column-type changes (e.g. VARCHAR length) aren't silently ignored.
- `just backend makemigration MSG="..."` autogenerates a revision. **Review the generated script before committing** — autogenerate doesn't catch every drift (check constraints, server defaults, table renames).
- `just backend migrate` runs `alembic upgrade head`.

## Seed

- `backend.seed` populates task definitions and news items. Idempotent but **skip-on-conflict** — existing rows are not updated, so use `seed-reset` after changing seed content.
- `backend.seed_reset` truncates seed-owned tables then re-seeds. Refuses `APP_ENV=prod`.
- Demo users are defined as `DEMO_USERS` in `backend/seed.py`; the frontend account picker is derived from that list via `just gen-demo-accounts` (run from repo root, commit the resulting JSON).

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
