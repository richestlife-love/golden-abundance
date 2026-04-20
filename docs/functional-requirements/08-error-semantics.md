# 08 — Error Semantics

HTTP errors from the contract (`endpoints.md`) need explicit UX mapping — this is where requirements meet copy.

## Shape

- **Business errors**: `{"detail": "<message>"}` (FastAPI default via `HTTPException`).
- **Pydantic validation errors**: default structured list (multi-field).

## Mapping layer

- `frontend/src/api/errors.ts` — error class + code mapping.
- `frontend/src/ui/toasts.ts` — user-visible toast strings.
- Forms: `InterestForm.tsx`, `TicketForm.tsx`, `ProfileSetupForm.tsx` — inline validation + mapped server errors.

## Canonical business errors

| Endpoint | Code | Condition | Backend detail | User-visible copy |
|---|---|---|---|---|
| `POST /auth/google` | 401 | invalid/empty/non-email id_token | `id_token is empty` / `stub id_token must be an email in Phase 5: …` (dynamic, from `auth/google_stub.py`) | (chooser surfaces inline) |
| `POST /me/profile` | 409 | profile already complete | `Profile already complete` | (shouldn't happen via UI; guard routes) |
| `GET /tasks/{id}` | 404 | unknown task | `Task not found` | — |
| `POST /tasks/{id}/submit` | 400 | task has no form, or form_type mismatch | `This task does not accept submissions` / `form_type does not match task's declared form_type` | form stays open; `submit.error` shown inline |
| `POST /tasks/{id}/submit` | 404 | unknown task | `Task not found` | — |
| `POST /tasks/{id}/submit` | 409 | already completed | `Task already completed` | — |
| `POST /tasks/{id}/submit` | 412 | prerequisites unmet | `Task prerequisites are not yet completed` | — |
| `GET /teams/{id}`, `PATCH /teams/{id}`, join-request mutations | 404 | unknown team | `Team not found` | — |
| `DELETE …/{req_id}`, `POST …/{req_id}/{approve,reject}` | 404 | unknown request, or belongs to a different team | `Request not found` | — |
| `POST /teams/{id}/join-requests` | 409 | already member/leader/pending elsewhere, or own team | `Leaders cannot request to join their own team` / `Already a member of this team` / `Already a member of a different team` / `Already has a pending join request` | — |
| `DELETE …/{req_id}` | 403 | not the requester | `Only the requester can cancel a join request` | — |
| `POST …/{req_id}/approve` | 403 | not the leader | `Only the leader can approve` | toast `審核失敗，請再試一次` (frontend `onError`) |
| `POST …/{req_id}/reject` | 403 | not the leader | `Only the leader can reject` | toast `操作失敗` (frontend `onError`) |
| `POST /teams/{id}/leave` | 403 | leader can't leave own team | `Leaders cannot leave their own team` | — |
| `PATCH /teams/{id}` | 403 | not the leader | `Only the team leader can update it` | toast `儲存失敗` (frontend `onError`) |
| paginated endpoints | 400 | malformed cursor | `Invalid cursor` (from `InvalidCursorError` handler in `server.py`) | — |
| any | 401 | missing/invalid/expired bearer token | `Missing or invalid bearer token` | global handler: toast `您的工作階段已過期，請重新登入` + redirect `/sign-in?returnTo=…` |

**Gap**: the "User-visible copy" column above is still sparse for read paths and form-validation errors — a functional-requirements doc should enumerate every user-visible string for each error. Backend detail strings are now captured verbatim from the routers/services.

## Session expiry handler

Global registration (`frontend/src/api/client.ts:setSessionExpiredHandler`) catches 401 and calls `signOut({reason: "expired", returnTo})`:

1. Fire best-effort `POST /auth/logout` (ignore failure).
2. Toast `您的工作階段已過期，請重新登入`.
3. `tokenStore.clear()`.
4. Navigate to `/sign-in?returnTo=<current>`.
5. `queryClient.clear()` — last, so in-flight queries don't refetch with the cleared token.
