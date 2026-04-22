# 07 — User Journeys

Narrative flows that traverse multiple routes / endpoints. Each maps to acceptance criteria.

## 1. First-time sign-up

```
/sign-in (single "Continue with Google" button)
  → supabase.auth.signInWithOAuth({ provider: "google",
      options: { redirectTo: origin + "/auth/callback?returnTo=…" }})
  → Supabase → Google consent → back to /auth/callback?code=…
  → supabase.auth.exchangeCodeForSession(window.location.search)
      (Supabase persists the session in localStorage, auto-refresh on)
  → navigate to returnTo ?? "/"
  → /welcome (via _authed guard seeing profile_complete=false)
  → ProfileSetupForm
  → POST /me/profile (atomic: profile + led team)
      ↳ first authed call materialises the UserRow via current_user's
        upsert-on-first-sight
  → /home
```

## 2. Returning sign-in

```
/sign-in
  → supabase.auth.signInWithOAuth → Google → /auth/callback → exchange
  → / (index guard checks supabase.auth.getSession)
  → profile_complete? yes → /home ; no → /welcome
```

## 3. Session expiry mid-session

```
any backend request → 401 (Supabase token rejected by JWKS verifier,
                             most often because it's expired and auto-refresh
                             hasn't caught up yet)
  → setSessionExpiredHandler fires
  → signOut({ reason: "expired", returnTo: <current path> })
    ├── supabase.auth.signOut() (clears Supabase's localStorage keys)
    ├── pushToast("您的工作階段已過期，請重新登入")
    ├── router.navigate({ to: "/sign-in", search: { returnTo } })
    └── queryClient.clear() (last, so in-flight queries don't refetch
                              against the torn-down session)
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

> ⚠️ **Backend ready, UI deferred.** `GET /teams`, `GET /teams/{id}`, and `POST /teams/{id}/join-requests` all exist on the backend, but no `/teams` or `/teams/:teamId` routes are registered in `frontend/src/router.ts`. The T3 challenge's `TeamForm` (`frontend/src/screens/TeamForm.tsx`) holds the UI surface but is currently dead-ended: Phase 7 hardening removed `T3` from `SUPPORTED_TASK_DISPLAY_IDS` so `/tasks/T3/start` returns 404, and the MyScreen "搜尋加入" CTA shows a "coming soon" toast instead of navigating. The flow below is the target; treat as deferred until the list/detail screens (or a rewired `TeamForm` against `teamsInfiniteQueryOptions`) ship.

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
