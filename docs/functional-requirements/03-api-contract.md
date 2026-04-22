# 03 — API Contract

Full schemas live in `backend/src/backend/contract/*.py`. Endpoint catalog in `backend/src/backend/contract/endpoints.md`. This page captures what a FR reviewer needs: the endpoint × response × error matrix, server-derived fields, and known contract gaps.

All paths under `/api/v1/`. Auth column: `—` public, `B` bearer required. Every authed endpoint verifies an RS256 JWT issued by Supabase via the project's JWKS endpoint (`backend/src/backend/auth/supabase.py`); OAuth flow is driven entirely by the frontend's Supabase SDK. Every model inherits from `StrictModel` (`extra="forbid"` — unknown fields raise on both request and response).

## Endpoint matrix

| Endpoint | Auth | Request | Response (200 unless noted) | Error codes |
|---|---|---|---|---|
| `GET /me` | B | — | `User` | — |
| `POST /me/profile` | B | `ProfileCreate` | `MeProfileCreateResponse` | 409 |
| `PATCH /me` | B | `ProfileUpdate` | `User` | — |
| `GET /me/tasks` | B | — | `list[Task]` | — |
| `GET /me/teams` | B | — | `MeTeamsResponse` | — |
| `GET /me/rewards` | B | — | `list[Reward]` | — |
| `GET /tasks/{id}` | B | — | `Task` | 404 |
| `POST /tasks/{id}/submit` | B | `SubmitBody` (discriminated on `form_type`) | `TaskSubmissionResponse` | 400 / 404 / 409 / 412 |
| `GET /teams` | B | `q,topic,leader_display_id,cursor,limit` | `Paginated[TeamRef]` | — |
| `GET /teams/{id}` | B | — | `Team` | 404 |
| `PATCH /teams/{id}` | B | `TeamUpdate` | `Team` | 403 / 404 |
| `POST /teams/{id}/join-requests` | B | — | `JoinRequest` (201) | 404 / 409 |
| `DELETE /teams/{id}/join-requests/{req_id}` | B | — | 204 | 403 / 404 |
| `POST …/{req_id}/approve` | B | — | `Team` | 403 / 404 |
| `POST …/{req_id}/reject` | B | — | 204 | 403 / 404 |
| `POST /teams/{id}/leave` | B | — | 204 | 403 / 404 |
| `GET /leaderboard/users` | B | `period,cursor,limit` | `Paginated[UserLeaderboardEntry]` | — |
| `GET /leaderboard/teams` | B | `period,cursor,limit` | `Paginated[TeamLeaderboardEntry]` | — |
| `GET /news` | B | `cursor,limit` | `Paginated[NewsItem]` | — |

## Auth boundary

`POST /auth/google` and `POST /auth/logout` no longer exist — Phase 6 removed them. Sign-in is driven entirely by the frontend's Supabase SDK (`@supabase/supabase-js`); sign-out is a client-side `supabase.auth.signOut()` call. The backend only verifies incoming `Authorization: Bearer <supabase-jwt>` tokens and upserts a `UserRow` keyed on the Supabase `auth.users.id` UUID the first time it sees a new `sub`.

## Server-derived fields

These are computed server-side; clients must not attempt to mirror the logic unless flagged as a gap.

- **`User.name`** — `zh_name ?? nickname ?? display_id` (the opaque `U…` id). The fallback used to be the email local-part; switched so a profile-incomplete user doesn't leak email identity via `UserRef.name`.
- **`Task.status`** — `locked` when any id in `requires` is not in caller's completed set; `expired` when `due_at` in the past and not completed.
- **`Task.progress`** — authoritative; UI displays `steps[].done` for UX only and never computes progress from it.
- **`Team.role`** — caller's relationship (`"leader" | "member" | null`).
- **`Team.requests`** — populated only when caller is leader; null for members and outsiders.
- **`TeamChallengeProgress.total`** — `max(led_total, joined_total)` for `is_challenge` tasks.
- **`Reward.task_title` / `Reward.bonus`** — snapshotted at earn time; later `task_def` changes don't mutate earned rewards.

## Discriminated union — `SubmitBody`

The `form_type` discriminator selects between `InterestFormBody` (T1-style) and `TicketFormBody` (T2-style). FastAPI emits tagged `oneOf` in OpenAPI; generated TS clients get a clean discriminated union. See `backend/src/backend/contract/task.py` for field lists.

## Gaps / inconsistencies

- **Reward claim** — `Reward.status: "claimed"` and `claimed_at` exist but there's no `POST /rewards/{id}/claim` in the catalog.
- **Leaderboard period drift** — contract allows `month`, `endpoints.md` only references `week` as default. Verify against `services/leaderboard.py`.
- **Avatar** — `User.avatar_url` is read-only today: the field exists on the `User` response but is not present in `ProfileUpdate`, so `PATCH /me` with `avatar_url` will 422 under `StrictModel` (`contract/user.py:56-67`). No file-upload endpoint either.
- **Team search** returns `TeamRef`, not `Team` — detail view requires a second call.
- **`Team.rank`** on the full `Team` response: population rules unclear; probably set only when returning from leaderboard queries.
- **No task-step endpoint** — `TaskStep.done` has no direct transition; inferred from `POST /tasks/{id}/submit`.

## Conventions

- **Error shape** — FastAPI default. Business errors: `{"detail": "<message>"}`. Pydantic validation errors: default structured list.
- **Content type** — `application/json` only. UTF-8.
- **Datetimes** — ISO 8601 with `Z` (UTC).
- **Pagination** — cursor-based. `next_cursor` null ⇒ end of results. No `total` field.
- **Patterns** — `User.display_id` matches `^U[A-Z0-9]{3,7}$`; `Team.display_id` matches `^T-[A-Z0-9]{3,10}$`; `Task.color` matches `^#[0-9a-fA-F]{6}$`.
