# 02 — DB Schema

Entities, relationships, and cross-layer invariants. Full column detail is in `backend/src/backend/db/models.py`.

## Entities at a glance

| Table | Purpose | Key relations |
|---|---|---|
| `users` | Human accounts | leads 0–1 team; many memberships; many task progress/rewards |
| `teams` | A leader's team | leader → users (1:1 unique); has many memberships, join_requests |
| `team_memberships` | User ↔ team | composite PK `(team_id, user_id)`; user unique across all teams |
| `join_requests` | Pending/approved/rejected join asks | partial-unique on `(user_id WHERE status='pending')` |
| `task_defs` | Template of a task | has many steps, many requires, many progress rows, many rewards |
| `task_def_requires` | DAG edges between task defs | composite PK `(task_def_id, requires_id)` |
| `task_step_defs` | Ordered checklist for a task def | unique `(task_def_id, order)` |
| `task_progress` | Per-user status on a task def | unique `(user_id, task_def_id)` |
| `task_step_progress` | Per-user done-flag on a step | unique `(user_id, step_id)` |
| `rewards` | Earned/claimed bonuses | unique `(user_id, task_def_id)` |
| `news_items` | Announcements | indexed on `published_at`, `pinned` |

All tables have a UUID v4 PK and a UTC `created_at` (or analog) default.

## Enum-like columns

| Column | Values |
|---|---|
| `join_requests.status` | `pending` \| `approved` \| `rejected` |
| `task_defs.tag` | `探索` \| `社区` \| `陪伴` |
| `task_defs.form_type` | `interest` \| `ticket` \| null |
| `task_progress.status` | `todo` \| `in_progress` \| `completed` |
| `rewards.status` | `earned` \| `claimed` |
| `news_items.category` | `公告` \| `活動` \| `通知` |

Stored as `VARCHAR(16)` (not PG enums), so adding a value is migration-free. All consumers must match.

## Invariants

- **One led team per user** — `teams.leader_id UNIQUE` lets `GET /me/teams` use `scalar_one_or_none()`.
- **One team membership per user** — globally, not per team: `uq_membership_user` on `team_memberships.user_id`.
- **At most one pending join request per user** — postgres partial unique index `uq_join_requests_one_pending_per_user` on `user_id WHERE status='pending'`. Closes the race the service-layer check in `create_join_request` can lose.
- **No double-awarded reward** — `uq_reward_user_task` on `(user_id, task_def_id)` backstops the service layer.
- **Task step ordering unique** — `(task_def_id, order)` must be unique.
- **Task progress 0..1** — `CHECK progress >= 0 AND progress <= 1`.

## Cascades

- Delete a user → cascades through teams (they led), memberships, join_requests, task_progress, task_step_progress, rewards.
- Delete a task_def → cascades through task_def_requires, task_step_defs, task_progress, task_step_progress, rewards.

Cascade depth matters for GDPR-style deletes. No soft-delete column exists on any table.
