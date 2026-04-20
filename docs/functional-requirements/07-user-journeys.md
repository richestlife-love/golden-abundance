# 07 — User Journeys

Narrative flows that traverse multiple routes / endpoints. Each maps to acceptance criteria.

## 1. First-time sign-up

```
/sign-in (chooser)
  → POST /auth/google (new email)
  → tokenStore.set(token)
  → /welcome
  → ProfileSetupForm
  → POST /me/profile (atomic: profile + led team)
  → /home
```

## 2. Returning sign-in

```
/sign-in (chooser)
  → POST /auth/google
  → tokenStore.set(token)
  → / (index guard)
  → profile_complete? yes → /home ; no → /welcome
```

## 3. Session expiry mid-session

```
any request → 401
  → setSessionExpiredHandler fires
  → pushToast("您的工作階段已過期，請重新登入")
  → tokenStore.clear()
  → /sign-in?returnTo=<previous-path>
  → queryClient.clear()
```

## 4. Task completion with reward

```
/tasks → TaskCard → /tasks/:taskId → /tasks/:taskId/start
  → InterestForm or TicketForm
  → POST /tasks/{id}/submit
  → TaskSubmissionResponse {task, reward?}
  → pushSuccess({color, points, bonus, title})  ← celebration overlay
  → invalidate: myTasks, task(id), myRewards, leaderboard*
  → navigate to /tasks/:taskId (detail)
```

## 5. Team join (requester side)

> ⚠️ **Backend ready, UI deferred.** `GET /teams`, `GET /teams/{id}`, and `POST /teams/{id}/join-requests` all exist on the backend, but no `/teams` or `/teams/:teamId` routes are registered in `frontend/src/router.ts`. The only in-app entry to creating a join request today is the T3 challenge's `TeamForm`, which uses hard-coded demo teams (`frontend/src/screens/TeamForm.tsx`). The flow below is the target; treat as deferred until the list/detail screens ship.

```
/teams (search with q/topic/leader_display_id)
  → /teams/:teamId (detail)
  → POST /teams/{id}/join-requests
  → local UI shows pending
  → (wait for leader approval)
  → on approval: GET /me/teams now shows `joined`
```

## 6. Team join (leader side)

```
/me → led team card → pending list
  → approve: POST …/{req_id}/approve → Team response with requester moved to members
  → reject:  POST …/{req_id}/reject → 204
```

## 7. Profile edit

```
/me/profile/edit
  → PATCH /me (partial ProfileUpdate)
  → updated User returned
  → invalidate: me
```

## 8. T3 team-challenge completion (no submit)

```
Leader: auto-created team at profile completion
  → members join (journeys 5+6)
  → total = max(led_total, joined_total) reaches cap=6
  → services/task.py flips T3 status → "completed" for every team member
  → no Reward row created (T3 has bonus=None in seed)
```

Each journey's error branches (409/412/403) need UX copy — see `08-error-semantics.md`.

**Cache invalidation note**: mutations refresh related reads (`me`, `me/*`, `team(id)`, `teams`, `leaderboard*`, `task(id)`). Exact key-by-key mapping is implementation detail in `frontend/src/mutations/*.ts` and `frontend/src/queries/keys.ts`.
