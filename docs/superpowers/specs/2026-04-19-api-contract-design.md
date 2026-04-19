# API Contract — Design

- **Date:** 2026-04-19
- **Phase:** 2 of the [production launch plan](../../production-launch-plan.md)
- **Status:** Design approved; ready for implementation planning

## Overview

This spec is the Phase 2 deliverable of the overall [production launch plan](../../production-launch-plan.md). It defines the wire-format contract between the `frontend/` React app and the forthcoming FastAPI service in `backend/` — Pydantic models and a human-readable endpoint catalog — produced before the backend is built, so backend work can proceed in parallel with the frontend's Vite/TypeScript migration (Phase 1) without re-negotiating shapes later.

**Scope narrowed from the plan.** The plan's Phase 2 originally listed "stub FastAPI endpoints returning mock data server-side" alongside the Pydantic models; during brainstorming we narrowed Phase 2 to **contract-only** — no running server — because the user will build the backend in parallel from this spec. A runnable stub, if wanted later, would be an addendum before Phase 5. The plan doc should be updated to match (see §9).

The contract is consumed by:

1. **The backend** (Phases 5-6) — imports the Pydantic models directly into FastAPI route signatures; OpenAPI is generated automatically from them.
2. **The frontend** (Phase 4) — receives TypeScript types generated from these Pydantic models via `datamodel-code-generator` or equivalent. Generation tooling is set up later; the Pydantic models are the source of truth either way.

### Non-goals

- Running FastAPI service, middleware, CORS, settings — Phase 5.
- Real Google ID-token verification — Phase 6. Contract defines the exchange shape.
- Hand-written OpenAPI YAML — generated from FastAPI in Phase 5.
- Database schema, migrations, persistence — Phase 5.
- File uploads (avatars remain color-gradient strings for now).
- Rate limiting, observability, auth hardening, refresh tokens.
- i18n — strings in the app stay hard-coded Chinese for this phase.

## Approach decisions

| Decision | Choice | Why |
|---|---|---|
| Deliverable | Contract-only (no stub backend) | User will build backend in parallel from the spec. |
| Scope | Full surface of the frontend | Prototype-to-production migration; lock down everything now. |
| Auth mechanism | Bearer JWT | Simple, standard, easy to stub; CORS-friendly for SPA. |
| Identity | UUID canonical + `display_id` short code | Preserves existing shareable codes (`UJETKAN`, `T-MING2024`) with clean machine identity. |
| Format | Pydantic 2 models + markdown endpoint doc | FastAPI generates OpenAPI automatically; hand-writing OpenAPI would duplicate. |
| URL style | REST + named actions | Business verbs (approve/reject/leave/submit) map cleanly to POST actions rather than PATCH-status mutations. |

## 1. Entities (Pydantic 2 models)

All IDs are `UUID` unless noted otherwise. All timestamps are `datetime` serialized as ISO 8601 with explicit `Z` (UTC). Enum-like string fields use `typing.Literal`.

### 1.1 Shared primitives — `common.py`

- `UserRef` — thin embedding for use inside other entities: `{id, display_id, name, avatar_url}`.
- `TeamRef` — thin embedding: `{id, display_id, name, topic, leader: UserRef}`.
- `Paginated[T]` — generic: `{items: list[T], next_cursor: str | None}`. `next_cursor` is the cursor to pass to the next call (not the current cursor echoed back); `null` means no more pages. No `total` field — counting is expensive at scale and no current screen uses it; add later if a UI needs it.

No custom `ProblemDetail` — FastAPI's default `{detail}` is used.

### 1.2 `User` — `user.py`

**`User`** (response shape):

| Field | Type | Notes |
|---|---|---|
| `id` | `UUID` | Canonical. |
| `display_id` | `str` | `^U[A-Z0-9]{4,7}$`, e.g. `UJETKAN`. |
| `email` | `EmailStr` | From Google. |
| `zh_name` | `str \| None` | |
| `en_name` | `str \| None` | |
| `nickname` | `str \| None` | |
| `name` | `str` | Server-derived display name: `zh_name` if set, else `nickname`, else email-prefix. |
| `phone` | `str \| None` | Digits only; no formatting. |
| `phone_code` | `str \| None` | Dial prefix, e.g. `+886`. |
| `line_id` | `str \| None` | |
| `telegram_id` | `str \| None` | |
| `country` | `str \| None` | Free string. Frontend picks from a known set. |
| `location` | `str \| None` | Region within country. |
| `avatar_url` | `str \| None` | Placeholder during Phase 2; still a gradient string on the client. |
| `profile_complete` | `bool` | Derived; drives frontend "show profile setup" gate. |
| `created_at` | `datetime` | |

**`ProfileCreate`** (`POST /me/profile`):

Required: `zh_name`, `phone`, `phone_code`, `country`, `location`.
Optional: `en_name`, `nickname`, `line_id`, `telegram_id`.

**`ProfileUpdate`** (`PATCH /me`):

All `ProfileCreate` fields, all optional (partial update).

### 1.3 `Task` — `task.py`

The user-facing `Task` is a server-side merge of the global task definition and the caller's per-user state. Internal decomposition is up to the backend.

**`Task`**:

| Field | Type | Notes |
|---|---|---|
| `id` | `UUID` | |
| `display_id` | `str` | Short task code, e.g. `T1`. |
| `title` | `str` | |
| `summary` | `str` | One-liner. |
| `description` | `str` | Long copy. |
| `tag` | `Literal["探索","社区","陪伴"]` | Closed set for now; extensible later. |
| `color` | `str` | `^#[0-9a-fA-F]{6}$`. |
| `points` | `int` | `ge=0`. |
| `bonus` | `str \| None` | e.g. `"金鑰匙紀念筆"`. |
| `due_at` | `datetime \| None` | Null for evergreen tasks. |
| `est_minutes` | `int` | `ge=0`. |
| `is_challenge` | `bool` | True for team challenges. |
| `requires` | `list[UUID]` | Prerequisite task IDs; caller must have `status == "completed"` on each before this task unlocks. |
| `cap` | `int \| None` | For team challenges: target team size. |
| `form_type` | `Literal["interest","ticket"] \| None` | Which body to send to `POST /tasks/{id}/submit`. `None` means task has no form submission. |
| `status` | `Literal["todo","in_progress","completed","expired","locked"]` | Per-caller. |
| `progress` | `float \| None` | `ge=0, le=1`; per-caller. |
| `steps` | `list[TaskStep]` | Per-caller (`done` reflects the caller's state). |
| `team_progress` | `TeamChallengeProgress \| None` | Non-null iff `is_challenge` and caller has a team. |
| `created_at` | `datetime` | |

**`TaskStep`**: `{id: UUID, label: str, done: bool, order: int}`.

**`TeamChallengeProgress`**: `{total: int, cap: int, led_total: int, joined_total: int}`. `total = max(led_total, joined_total)` — the higher of the caller's led-team or joined-team head count. Server-computed; frontend displays only.

**Derivation rules (server-authoritative):**

- `status == "locked"` iff any id in `requires` is not in the caller's set of completed task ids. Frontend and backend must use this rule; do not invent alternatives.
- `status == "expired"` iff `due_at` is set and in the past and the task is not yet completed by the caller.
- `progress` is authoritative. Clients display `steps[].done` for checklist UX but must never compute `progress` from step counts; the server's value wins.

**Form bodies (discriminated union for `POST /tasks/{task_id}/submit`)**:

Each body carries a `form_type` literal that acts as the Pydantic 2 discriminator. The endpoint declares `Annotated[InterestFormBody | TicketFormBody, Field(discriminator="form_type")]` — OpenAPI emits a tagged `oneOf`, and generated TypeScript gets a clean discriminated union.

- **`InterestFormBody`** (task 1):
  - `form_type: Literal["interest"]`
  - `name: str` (required)
  - `phone: str` (required)
  - `interests: list[str]` (required, `min_length=1`)
  - `skills: list[str]` (optional; defaults to `[]`)
  - `availability: list[str]` (required, `min_length=1`)

- **`TicketFormBody`** (task 2):
  - `form_type: Literal["ticket"]`
  - `name: str` (required)
  - `ticket_725: str` (required)
  - `ticket_726: str` (required)
  - `note: str \| None` (optional)

Task 3 (team challenge) has no form body — its state is driven by team operations. Task 4 (expired training) has no form body either — its status is fixed at `expired`.

Clients pick the body by reading `Task.form_type` from the task response: `"interest"` → send `InterestFormBody` (with `form_type: "interest"`), `"ticket"` → send `TicketFormBody` (with `form_type: "ticket"`), `None` → task does not accept submissions (400).

**`TaskSubmissionResponse`** (response for submit): `{task: Task, reward: Reward | None}`.

### 1.4 `Team` — `team.py`

**`Team`**:

| Field | Type | Notes |
|---|---|---|
| `id` | `UUID` | |
| `display_id` | `str` | `^T-[A-Z0-9]{3,10}$`, e.g. `T-MING2024`. |
| `name` | `str` | Default `"{leader_name}的團隊"`; user can override with `alias`. |
| `alias` | `str \| None` | Leader's custom display name. |
| `topic` | `str` | Free text; starts as `"尚未指定主題"` for new teams. |
| `leader` | `UserRef` | |
| `members` | `list[UserRef]` | Excludes leader. |
| `cap` | `int` | Default 6 for challenge-eligibility; teams can grow past cap. |
| `points` | `int` | Lifetime. |
| `week_points` | `int` | Rolling 7-day. |
| `rank` | `int \| None` | Null until leaderboard computes. |
| `role` | `Literal["leader","member"] \| None` | Per-caller. Null if caller is not in the team. |
| `requests` | `list[JoinRequest] \| None` | Populated only when `role == "leader"`. Otherwise `None`. |
| `created_at` | `datetime` | |

**`JoinRequest`**: `{id: UUID, team_id: UUID, user: UserRef, status: Literal["pending","approved","rejected"], requested_at: datetime}`.

**`TeamUpdate`** (`PATCH /teams/{team_id}`): `{name: str | None, alias: str | None, topic: str | None}` — all optional.

### 1.5 `Rank` — `rank.py`

- **`RankPeriod`** = `Literal["week","month","all_time"]`.
- **`UserRankEntry`**: `{user: UserRef, rank: int, points: int, week_points: int}`.
- **`TeamRankEntry`**: `{team: TeamRef, rank: int, points: int, week_points: int}`.

### 1.6 `Reward` — `rewards.py`

| Field | Type | Notes |
|---|---|---|
| `id` | `UUID` | |
| `user_id` | `UUID` | Owner. |
| `task_id` | `UUID` | Source task. |
| `task_title` | `str` | Denormalized for list views. |
| `bonus` | `str` | The reward description — from `Task.bonus` at earn time. |
| `status` | `Literal["earned","claimed"]` | |
| `earned_at` | `datetime` | |
| `claimed_at` | `datetime \| None` | |

A task with `bonus == None` does **not** create a `Reward` row on completion. `Reward.bonus` is therefore always non-null.

### 1.7 `News` — `news.py`

**`NewsItem`**: `{id: UUID, title: str, body: str, category: Literal["公告","活動","通知"], image_url: str \| None, published_at: datetime, pinned: bool}`.

`category` drives the badge colour on the home-screen news carousel (the mapping from category → colour lives on the client; see `frontend/app.jsx` NewsBoard).

### 1.8 `Auth` — `auth.py`

- **`GoogleAuthRequest`**: `{id_token: str}`.
- **`AuthResponse`**: `{access_token: str, token_type: Literal["bearer"], expires_in: int, user: User, profile_complete: bool}`.
- **`TokenClaims`** (documentation only — describes the JWT payload shape; **not exported from `backend.contract.__init__`** and not used as a request/response body): `{sub: UUID, email: EmailStr, exp: int, iat: int}`.

## 2. Endpoints

All paths under `/api/v1/`. `Auth` column: `—` = public, `B` = `Authorization: Bearer <token>` required.

### 2.1 Auth

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `/auth/google` | — | `GoogleAuthRequest` | 200 `AuthResponse` | 401 bad id_token |
| POST | `/auth/logout` | B | — | 204 | — (best-effort; tokens expire naturally) |

### 2.2 Me

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/me` | B | — | 200 `User` | 401 |
| POST | `/me/profile` | B | `ProfileCreate` | 200 `{user: User, led_team: Team}` | 401, 409 already complete, 422 validation |
| PATCH | `/me` | B | `ProfileUpdate` | 200 `User` | 401, 422 |
| GET | `/me/tasks` | B | — | 200 `list[Task]` | 401 |
| GET | `/me/teams` | B | — | 200 `{led: Team \| None, joined: Team \| None}` | 401 |
| GET | `/me/rewards` | B | — | 200 `list[Reward]` | 401 |

### 2.3 Tasks

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/tasks/{task_id}` | B | — | 200 `Task` | 401, 404 |
| POST | `/tasks/{task_id}/submit` | B | discriminated union `InterestFormBody \| TicketFormBody` on `form_type` | 200 `TaskSubmissionResponse` | 400 task has no form / wrong `form_type`, 401, 404, 409 already completed (idempotent — resubmitting a completed task returns 409 rather than silently succeeding), 412 prerequisites unmet, 422 |

### 2.4 Teams

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/teams` | B | query: `q`, `topic`, `leader_display_id`, `cursor`, `limit` | 200 `Paginated[TeamRef]` | 401, 422 |
| GET | `/teams/{team_id}` | B | — | 200 `Team` | 401, 404 |
| PATCH | `/teams/{team_id}` | B | `TeamUpdate` | 200 `Team` | 401, 403 not leader, 404, 422 |
| POST | `/teams/{team_id}/join-requests` | B | — | 201 `JoinRequest` | 401, 404, 409 (see note below) |
| DELETE | `/teams/{team_id}/join-requests/{req_id}` | B | — | 204 | 401, 403 not requester, 404 |
| POST | `/teams/{team_id}/join-requests/{req_id}/approve` | B | — | 200 `Team` | 401, 403 not leader, 404 |
| POST | `/teams/{team_id}/join-requests/{req_id}/reject` | B | — | 204 | 401, 403 not leader, 404 |
| POST | `/teams/{team_id}/leave` | B | — | 204 | 401, 403 leader cannot leave own team, 404 |

**409 on `POST /teams/{team_id}/join-requests`** fires when any of the following holds: caller is already a member or leader of this team; caller already has a pending request to this team; caller is already a member (or has a pending request) of **any other** team. A user may belong to at most one joined team at a time, and may have at most one outstanding join request at a time.

**No `DELETE /teams/{team_id}`.** The frontend does not expose a "disband" affordance anywhere — the "退出" button in `TeamCard` is gated by `!isLeader` (see `frontend/app.jsx:6845`). Leaders manage their team via `PATCH` (rename/topic); they cannot disband it. This preserves the invariant that every profile-complete user has a led team.

### 2.5 Rank

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/rank/users` | B | query: `period=week`, `cursor`, `limit=50` | 200 `Paginated[UserRankEntry]` | 401, 422 |
| GET | `/rank/teams` | B | query: `period=week`, `cursor`, `limit=50` | 200 `Paginated[TeamRankEntry]` | 401, 422 |

### 2.6 News

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/news` | B | query: `cursor`, `limit=20` | 200 `Paginated[NewsItem]` (sorted `pinned DESC, published_at DESC`) | 401, 422 |

### 2.7 Endpoint notes

- **No `POST /teams`.** Every user's led team is auto-created by `POST /me/profile`. Users cannot lead more than one team. Multi-team leadership, if ever wanted, is a new endpoint.
- **No `DELETE /teams/{team_id}`.** Leaders cannot disband — see §2.4 note. The `leaveLedTeam` handler in `frontend/app.jsx` is dead code (not wired to any button).
- **`GET /me/teams.led` is effectively non-null for any profile-complete caller.** The led team is created atomically with profile completion and cannot be disbanded.
- **`POST /tasks/{task_id}/submit`** uses a task-dependent discriminated body keyed on `form_type`. Task-scoped route was chosen over per-form endpoints to keep the frontend's mental model task-centric.
- **Task 3 (team challenge) has no endpoint.** Its status is derived server-side from team membership. Any team-membership-mutating action (`approve`, `leave`, etc.) recomputes the caller's task 3 status in the same transaction.
- **`Team.requests` is caller-scoped.** Members see `None`; only the leader sees the pending queue. Enforced server-side, not by field omission on the client.

## 3. Auth flow

```
┌────────┐   GIS   ┌───────┐    POST /api/v1/auth/google    ┌──────────┐
│ client │ ──────▶ │ Google│ ─── id_token ──▶               │ backend  │
└────────┘         └───────┘                    upsert user │          │
     │                                          mint JWT    │          │
     │ ◀── AuthResponse (access_token, user, profile_complete) ─────── │
     │                                                      └──────────┘
     │ 200 Bearer <access_token>
     ▼
  (all protected endpoints)
```

**Sign-in:**

```
POST /api/v1/auth/google
Body:  { "id_token": "<Google ID token>" }

200:   { access_token, token_type: "bearer", expires_in: 86400,
         user: User, profile_complete: bool }
401:   invalid/expired id_token
```

Backend responsibilities inside this endpoint (Phase 5 when the handler is written):

- Verify Google ID token (audience, signature, expiry). Phase 5 will scaffold a stub handler that accepts any non-empty `id_token`; real verification against Google's JWKS lands in Phase 6. (Phase 2 produces no running service, so there is nothing to stub in this phase.)
- Upsert user by email. First-time users get a generated `display_id` (`U` + deterministic hash of email, collision-suffixed) and `profile_complete=false`.
- Mint a JWT with claims `{sub: user.id, email, exp, iat}`, HS256, 24h TTL. Secret from env.

**Protected requests:**

```
Authorization: Bearer <access_token>
```

401 on missing/invalid/expired token. Frontend re-runs sign-in flow on 401.

**Profile completion gate:** `profile_complete` is surfaced on both the `AuthResponse` and `GET /me`. When `false`, the frontend routes to profile setup. `POST /me/profile` atomically creates the profile AND the user's led team (a single transaction) and flips `profile_complete` to `true`.

**Logout:** `POST /auth/logout` is best-effort. Without refresh tokens or a server-side session table, real revocation isn't possible in Phase 2 — tokens expire naturally. Frontend drops the token from client storage regardless of response. A denylist can be added in Phase 6 if needed.

**Deferred:** refresh tokens, CSRF (N/A for Bearer), denylist, frontend token-storage recommendation (Phase 1 decision).

## 4. Errors

FastAPI defaults — no custom envelope.

**Simple errors** — business-logic failures (auth, not-found, forbidden, conflict, precondition):

```json
{ "detail": "Task requires prerequisites to be completed first." }
```

**Validation errors** — Pydantic body/query failures:

```json
{ "detail": [
  { "loc": ["body", "phone"], "msg": "field required", "type": "value_error.missing" }
]}
```

**Status codes used consistently:**

| Status | Meaning |
|---|---|
| 200 | Success with body |
| 201 | Resource created (JoinRequest) |
| 204 | Success, no body (logout, leave, reject, delete, cancel) |
| 400 | Malformed request beyond Pydantic's reach |
| 401 | Missing/invalid/expired token |
| 403 | Authenticated but wrong role |
| 404 | Resource not found |
| 409 | Conflict (already member, already complete, already has joined team) |
| 412 | Precondition failed (task's `requires` unmet) |
| 422 | Pydantic validation failure |
| 500 | Server error |

Each endpoint's non-obvious error codes are listed in the `Errors` column of the tables in §2.

**Not adopted in Phase 2:** RFC 9457 Problem Details; machine-readable error codes inside `detail`. Room to add `{code, message}` inside `detail` later if the frontend needs to branch on specific errors.

## 5. Response shapes & pagination

**Responses are naked** — no `{data: ...}` wrapper. Matches FastAPI idiom.

**Two list shapes:**

1. **Bounded → naked array.** For collections that are small and fully returned every time:
   - `GET /me/tasks` → `list[Task]`
   - `GET /me/rewards` → `list[Reward]`
   - `GET /me/teams` → `{led, joined}` (object, same principle)

2. **Growable → `Paginated[T]`**. Cursor-based, opaque string cursor:
   - `GET /teams` → `Paginated[TeamRef]`
   - `GET /rank/users`, `/rank/teams` → `Paginated[UserRankEntry]`, `Paginated[TeamRankEntry]`
   - `GET /news` → `Paginated[NewsItem]`

**Pagination rules:**

- The response `next_cursor` is the cursor to pass on the next call. `null` → no more pages.
- Each paginated endpoint has a default `limit` and a hard max of 100. Over-max → 422.
- Cursor format is opaque to clients. Backend may encode offset, last-id, or timestamp; free to change.

**Why cursor over offset:** Rank and news are "recent on top" — offset pagination drifts as rows are inserted. Cursor is stable and trivially compatible with `ORDER BY id DESC` once persistence lands.

**Mutations** return the relevant resource directly — no envelope. Submissions return a small object with named fields (`{task, reward}`).

## 6. Versioning & transport

- **Base path:** `/api/v1/`. Nothing unversioned.
- **Version bumps:** `/api/v2/` is a breaking-change event (schema changes to existing fields, removed endpoints). Additive changes (new fields with defaults, new endpoints) stay on `/v1`.
- **Content type:** `application/json` only. UTF-8.
- **Datetimes:** ISO 8601 with `Z` (UTC). Pydantic 2 default.
- **Field naming.** Contract is **snake_case** (`est_minutes`, `phone_code`, `week_points`). The frontend prototype currently uses **camelCase** (`estMinutes`, `phoneCode`, `weekPoints`) — 73 occurrences across `app.jsx`. Phase 4 will rename either via a codegen option (`datamodel-code-generator --snake-case-field` is available but awkward to apply to JS consumers) or a thin adapter layer. Decision deferred to Phase 4; the contract stays snake_case regardless.

CORS, TLS, and deployment concerns are out of scope for this contract; they live with the backend service.

## 7. Deliverables & file layout

```
backend/
├── pyproject.toml              (existing; Phase 2 adds pydantic>=2 dep)
└── src/
    └── backend/
        ├── __init__.py
        ├── py.typed
        └── contract/
            ├── __init__.py      Re-exports: User, Task, Team, …
            ├── README.md        How to consume this module
            ├── endpoints.md     Endpoint catalog (expanded §2 tables)
            ├── common.py        UserRef, TeamRef, Paginated[T]
            ├── auth.py          GoogleAuthRequest, AuthResponse, TokenClaims
            ├── user.py          User, ProfileCreate, ProfileUpdate
            ├── task.py          Task, TaskStep, TeamChallengeProgress,
            │                    InterestFormBody, TicketFormBody,
            │                    TaskSubmissionResponse
            ├── team.py          Team, JoinRequest, TeamUpdate
            ├── rank.py          UserRankEntry, TeamRankEntry, RankPeriod
            ├── rewards.py       Reward
            ├── news.py          NewsItem
            ├── examples/        JSON fixtures per endpoint
            │   ├── auth_google_request.json
            │   ├── auth_google_response.json
            │   ├── user.json
            │   ├── profile_create.json
            │   ├── task_interest.json
            │   ├── task_team_challenge.json
            │   ├── team_as_leader.json
            │   ├── team_as_member.json
            │   ├── interest_form_submit.json
            │   ├── ticket_form_submit.json
            │   ├── rank_users_week.json
            │   ├── rank_teams_week.json
            │   ├── rewards_list.json
            │   └── news_list.json
            └── validate_examples.py   Smoke test: loads each fixture,
                                       validates against the matching model

docs/
└── superpowers/
    └── specs/
        └── 2026-04-19-api-contract-design.md   (this file)

justfile                         Add recipe: `just contract-validate` →
                                 runs validate_examples.py via `uv run`
```

**Consumer API:** `from backend.contract import User, Task, Team, ...`. The `__init__.py` re-exports the full surface.

**Why inside `backend/`:** the contract is Python code; the backend is already a Python package (`uv_build`, src layout, `pyproject.toml` present). Placing Pydantic anywhere else would spin up a second Python project for no benefit. Frontend cannot consume Python directly regardless — when TypeScript types are generated in Phase 4, the generator points at this module. Singular `contract` reflects that there is exactly one contract.

**Backend `pyproject.toml` changes in Phase 2:** add `pydantic>=2` to the currently-empty `dependencies`. No FastAPI dependency yet — that lands in Phase 5.

**Tests in Phase 2:** none beyond Pydantic's built-in validation. `validate_examples.py` iterates `examples/*.json` and parses each with its declared model; it exits non-zero on any failure. Wired into the justfile so the examples cannot drift from the schemas without the command failing.

## 8. Open points deferred past Phase 2

- **i18n.** All user-visible strings in the frontend are hard-coded Chinese. Contract leaves `tag`, `topic`, form option values, and news `category` as Chinese strings. Localization strategy — translation keys vs. enum IDs — is a later-phase decision.
- **Simplified vs Traditional characters.** `Task.tag` uses `"社区"` (simplified) because the frontend's `TASKS` data uses it (see `frontend/app.jsx:819, 898, 2324`). Other copy in the same codebase uses `"社區"` (traditional), e.g. news body (`:1234`) and team topics (`:9422`). The contract mirrors the existing inconsistency; Phase 8 (or an explicit i18n pass) should normalise to one set.
- **Tag taxonomy.** `Literal["探索","社区","陪伴"]` and `Literal["公告","活動","通知"]` are closed; growing either set is a schema migration. Future extensibility via a tags table is open.
- **Rank UX for self-lookup.** Cursor pagination on `/rank/users` and `/rank/teams` makes "jump to my position" and stable page numbers awkward. A follow-up endpoint — `GET /rank/users/me` (returns the caller's entry with surrounding context) or a `?include=caller` query param — would restore that UX without abandoning cursor pagination. Not blocking for Phase 2.
- **Avatar uploads.** `avatar_url` is a placeholder. The frontend currently uses gradient strings; real uploads arrive later with a storage choice (S3 / R2 / etc.) and a presigned-URL flow.
- **Realtime.** No WebSocket / SSE in Phase 2. Team join-request updates, rank board, news are polled.
- **Notifications.** No push or email endpoints.
- **Admin surface.** No admin endpoints for managing tasks, news, or users. CMS concerns are deferred.

## 9. Next steps & plan-doc reconciliation

1. **Update `docs/production-launch-plan.md` Phase 2** to match the narrowed scope — replace "Stub FastAPI endpoints returning mock data server-side" with a note that a runnable stub was deferred (either to a Phase 2.5 addendum or folded into Phase 5). Keep the Pydantic-models bullet. Keep validation as a `validate_examples.py` smoke test (no running server).
2. **Invoke the `writing-plans` skill** to produce an implementation plan for Phase 2 — the ordered set of tasks that produces the files listed in §7.
