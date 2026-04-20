# Endpoint Catalog — API v1

Full design spec: [`../../../../docs/superpowers/specs/2026-04-19-api-contract-design.md`](../../../../docs/superpowers/specs/2026-04-19-api-contract-design.md).

All paths under `/api/v1/`. `Auth` column: `—` = public, `B` = requires
`Authorization: Bearer <access_token>`. Bodies and responses reference
model names re-exported from `backend.contract`.

## Auth

### `POST /auth/google`
- Auth: —
- Body: `GoogleAuthRequest`
- 200: `AuthResponse`
- 401: invalid/expired `id_token`

### `POST /auth/logout`
- Auth: B
- Body: none
- 204 — best-effort; tokens expire naturally (no server-side revocation list)

## Me

### `GET /me`
- Auth: B
- 200: `User`

### `POST /me/profile`
- Auth: B (first-time profile completion)
- Body: `ProfileCreate`
- 200: `MeProfileCreateResponse`  — atomically creates profile + led team
- 409: profile already complete

### `PATCH /me`
- Auth: B
- Body: `ProfileUpdate`
- 200: `User`

### `GET /me/tasks`
- Auth: B
- 200: `list[Task]`

### `GET /me/teams`
- Auth: B
- 200: `MeTeamsResponse`  (`{led: Team | null, joined: Team | null}`; see spec §2.7: `led` is effectively non-null for profile-complete callers)

### `GET /me/rewards`
- Auth: B
- 200: `list[Reward]`

## Tasks

### `GET /tasks/{task_id}`
- Auth: B
- 200: `Task`
- 404

### `POST /tasks/{task_id}/submit`
- Auth: B
- Body: `SubmitBody` — discriminated union `InterestFormBody | TicketFormBody` on `form_type`
- 200: `TaskSubmissionResponse`
- 400: task has no form / body `form_type` does not match task's declared `form_type`
- 404
- 409: already completed (double-submit is **not** idempotent — returns 409)
- 412: prerequisites unmet

## Teams

### `GET /teams`
- Auth: B
- Query: `q`, `topic`, `leader_display_id`, `cursor`, `limit` (default 20, max 100)
- 200: `Paginated[TeamRef]`

### `GET /teams/{team_id}`
- Auth: B
- 200: `Team`
- 404
- `Team.requests` populated only when caller is the leader.

### `PATCH /teams/{team_id}`  (leader only)
- Auth: B
- Body: `TeamUpdate`
- 200: `Team`
- 403 not leader; 404

### `POST /teams/{team_id}/join-requests`
- Auth: B
- Body: (none)
- 201: `JoinRequest`
- 404
- 409 when any of: caller is already a member or leader of this team; caller already has a pending request to this team; caller is already a member (or has a pending request) of any other team. Leaders cannot submit a join-request to their own team (409).

### `DELETE /teams/{team_id}/join-requests/{req_id}`  (requester only)
- Auth: B
- 204
- 403 not requester; 404

### `POST /teams/{team_id}/join-requests/{req_id}/approve`  (leader only)
- Auth: B
- 200: `Team`  — requester moves from `requests` into `members`; task 3 recomputes
- 403 not leader; 404

### `POST /teams/{team_id}/join-requests/{req_id}/reject`  (leader only)
- Auth: B
- 204
- 403 not leader; 404

### `POST /teams/{team_id}/leave`  (member only)
- Auth: B
- 204
- 403 leader cannot leave own team; 404

## Leaderboard

### `GET /leaderboard/users`
- Auth: B
- Query: `period` (`LeaderboardPeriod`, default `"week"`), `cursor`, `limit` (default 50, max 100)
- 200: `Paginated[UserLeaderboardEntry]`

### `GET /leaderboard/teams`
- Auth: B
- Query: `period`, `cursor`, `limit`
- 200: `Paginated[TeamLeaderboardEntry]`

## News

### `GET /news`
- Auth: B
- Query: `cursor`, `limit` (default 20, max 100)
- 200: `Paginated[NewsItem]`  — sorted `pinned DESC, published_at DESC`

## Notes

- **No `POST /teams`** — every user's led team is auto-created by `POST /me/profile`.
- **No `DELETE /teams/{id}`** — the frontend UI gates the leave button on `!isLeader` (see `frontend/app.jsx:6845`); leaders have no disband path.
- **Error shape** — FastAPI default. Business errors return `{"detail": "<message>"}`; Pydantic validation errors return the default structured list.
- **Content type** — `application/json` only. UTF-8.
- **Datetimes** — ISO 8601 with `Z` (UTC).
- **Pagination** — `next_cursor` is the cursor to pass to the next call; `null` means no more pages.

See the design spec for full auth flow, status-code conventions, and deferred items.
