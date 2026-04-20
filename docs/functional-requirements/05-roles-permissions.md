# 05 — Roles & Permissions Matrix

Only three baseline "roles" exist; every endpoint's auth decision reduces to these, plus two contextual roles (leader/member of a specific team).

## Roles

| Role | Derivation | Capabilities |
|---|---|---|
| Anonymous | no bearer | `POST /auth/google` only |
| Authenticated, profile incomplete | `user.profile_complete = false` | `GET/PATCH /me`, `POST /me/profile`, `POST /auth/logout` |
| Authenticated, profile complete | `profile_complete = true` | full surface |
| Leader (of team T) | `teams.leader_id == user.id` | `PATCH /teams/T`, approve/reject joins, sees `Team.requests` |
| Member (of team T) | row in `team_memberships` | `POST /teams/T/leave`; sees `Team` with `role=member` |
| Requester (of join req R) | `join_requests.user_id == user.id` | `DELETE` their own request |

## Mutual exclusion rules

- A user is **either** leader-of-one **or** member-of-one (never both) — enforced by `team_memberships.user_id UNIQUE` + auto-leader-creation on profile completion.
- A user has **at most one** pending join request globally — partial unique index + service guard.

## Endpoint × role visibility

| Endpoint | Anon | Auth (incomplete) | Auth (complete) | Leader of team | Member of team | Requester |
|---|---|---|---|---|---|---|
| `POST /auth/google` | ✓ | ✓ | ✓ | — | — | — |
| `POST /auth/logout` | — | ✓ | ✓ | — | — | — |
| `GET /me` | — | ✓ | ✓ | — | — | — |
| `POST /me/profile` | — | ✓ | 409 | — | — | — |
| `PATCH /me` | — | ✓ | ✓ | — | — | — |
| `GET /me/{tasks,teams,rewards}` | — | ✓ | ✓ | — | — | — |
| `GET /tasks/{id}` | — | — | ✓ | — | — | — |
| `POST /tasks/{id}/submit` | — | — | ✓ | — | — | — |
| `GET /teams` | — | — | ✓ | — | — | — |
| `GET /teams/{id}` | — | — | ✓ (partial) | ✓ (full + requests) | ✓ (full) | — |
| `PATCH /teams/{id}` | — | — | 403 | ✓ | 403 | — |
| `POST /teams/{id}/join-requests` | — | — | ✓ | 409 (own) | 409 | — |
| `DELETE …/{req_id}` | — | — | 403 | — | — | ✓ |
| `POST …/{req_id}/approve` | — | — | 403 | ✓ | 403 | — |
| `POST …/{req_id}/reject` | — | — | 403 | ✓ | 403 | — |
| `POST /teams/{id}/leave` | — | — | 403 | 403 (own team) | ✓ | — |
| `GET /leaderboard/*`, `GET /news` | — | — | ✓ | — | — | — |

**Notes:**
- The "Auth incomplete" vs "Auth complete" split in the matrix above is **enforced on the frontend only**. Backend `current_user` (`backend/src/backend/auth/dependencies.py:22-40`) checks only the bearer token; it does not inspect `profile_complete`. The gating lives in `frontend/src/routes/_authed.tsx` — any client holding a bearer token can call business endpoints directly regardless of `profile_complete`. Treat this as a known gap to close before external exposure.
- `Team.requests` is populated **only** when caller is the team's leader; members and outsiders see `None`.
- The leader cannot leave their own team (no disband path exists).
