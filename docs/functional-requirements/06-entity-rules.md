# 06 — Entity Rules

For each entity: state machine first, then rules / invariants. Rules not captured by the schema or contract alone live mostly in `backend/src/backend/services/*.py`.

## User

```
new
  │  POST /auth/google
  ▼
exists(profile_complete=false)
  │  POST /me/profile
  ▼
exists(profile_complete=true, led_team=T)   ← PATCH /me mutates fields; state stays here
```

- **Name derivation** (server): `User.name = zh_name ?? nickname ?? email-local-part`.
- **Display ID**: `U[A-Z0-9]{3,7}`. Generated in `services/display_id.py`.
- **`POST /me/profile` side-effect**: `create_led_team` runs in the same transaction — enforces the "one led team per profile-complete user" invariant.

## Team

Created by a side-effect, never by a dedicated endpoint.

- **Auto-creation**: every `POST /me/profile` spawns exactly one led team — the only creation path.
- **Never deleted**: leader cannot leave own team; backend has no delete endpoint; frontend gates the leave button on `!isLeader`.
- **Mutates** via `PATCH /teams/{id}` (name/alias/topic), join-request approve/reject, member leave.
- **Default topic**: `"尚未指定主題"` until leader `PATCH`es.
- **Default cap**: 6 members. Schema allows per-team override; no UI to edit.
- **Display ID**: `T-[A-Z0-9]{3,10}`.

## Task (per user) — `task_progress.status`

```
(absent)  ──►  todo  ──►  in_progress  ──►  completed
                               ▲_______ (POST /tasks/{id}/submit with matching form_type)

locked   = derived (any id in `requires` not completed by caller)
expired  = derived (due_at < now AND not completed by caller)
```

- **Non-idempotent submit**: second submit on `completed` → **409**. Explicit product decision.
- **Prereq check**: submit → **412** if any id in `requires` is not completed by caller.
- **Form match**: submit → **400** if body `form_type` doesn't match task's declared `form_type`, or task has no form.
- **`in_progress`** may or may not be written by the backend — MSW fixture T2 shows `progress=0.4` but this is test-only. Verify in `services/task.py`.
- **T3 auto-completion**: `services/task.py` flips T3 to `completed` when `TeamChallengeProgress.total = max(led_total, joined_total) >= cap`. No explicit submit call.
- **Reward earning**: server side-effect on task completion **only when `task.bonus` is non-null**. Backstopped by `uq_reward_user_task`.

## Join request

```
(none)
  │  POST /teams/{id}/join-requests
  ▼
pending
  ├─ POST …/{id}/approve  → approved   (⇒ team_memberships row inserted; requester moves to members; T3 recomputes)
  ├─ POST …/{id}/reject   → rejected
  └─ DELETE …/{id}        → (gone)     (requester only)
```

- **At-most-one pending per user** (globally) — partial unique index `uq_join_requests_one_pending_per_user` + service guard (`JoinConflictError`).
- **Leader can't request to own team** — 409.
- **Member-of or pending-elsewhere** — 409 on new request.
- **Rejected requests do not block re-application** — guards in `services/team_join.py` check only `status = 'pending'`, so a user may submit a new request after rejection (the rejected row stays in the table as history).
- **Approve side-effect**: inserts `team_memberships` row, moves requester to `members`, triggers T3 recompute for the team.

## Reward

```
(none)  ──►  earned  ──►  claimed
         (side-effect of
          task.complete
          with bonus≠null)
```

- **Snapshot**: `task_title` + `bonus` frozen at earn time; later `task_def` changes don't mutate earned rewards.
- **Idempotent earning**: `uq_reward_user_task` backstops double-award races.
- **No reward row** when `task.bonus is None` — so `Reward.bonus` is always non-null by construction.
- **Claim transition has no endpoint yet** — `status` can go `earned → claimed` with `claimed_at`, but `POST /rewards/{id}/claim` is absent from the catalog.

---

## Cross-cutting

### News
- **Ordering**: `pinned DESC, published_at DESC` — server-authoritative; UI must not re-sort.

### Leaderboard
- **Period**: `week | month | all_time`. Default `week`. `period` only widens the `points` window; `week_points` on each entry is **always** the trailing-7-day sum regardless of `period` (`services/leaderboard.py:63-102`). There is no scheduled reset — the windows are recomputed on every read.
- **`Team.rank`** is nullable on the bare `Team` response and is populated only by the leaderboard queries (`services/team.py:154`).

### Content enums
- **Task tags** (`探索 / 社区 / 陪伴`) and **news categories** (`公告 / 活動 / 通知`) encoded as VARCHAR — adding a value is migration-free but all consumers must match.
- **Task color**: validated against `^#[0-9a-fA-F]{6}$` in the contract.
- **Tag inconsistency**: contract uses simplified `社区`; `TaskDetailScreen` rewrites to traditional `社區`. See `09-localization.md`.

### Concurrency posture
- Join-request creation race — partial index is the correct backstop.
- Reward earning race — unique constraint is the correct backstop.
- `sessionmaker(expire_on_commit=False)` in `backend/db/engine.py` — post-commit row attributes remain accessible without `refresh`.
