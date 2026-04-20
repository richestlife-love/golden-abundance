# 10 — Deferred / Out-of-Scope

Intentional gaps in the current codebase. Listing them explicitly so reviewers know they're **not** oversights.

## Auth

- **Real Google JWKS verification** (Phase 6) — stubbed in `backend/src/backend/auth/google_stub.py`: the `id_token` field of `POST /auth/google` is treated as the user's email verbatim, with no signature check. **Any valid email authenticates as that user.** Do not assume real Google verification is in place before Phase 6.
- **Server-side token revocation** — tokens expire naturally; `/auth/logout` is a best-effort no-op.
- **Refresh tokens** — access token only.

## Rewards

- **Claim endpoint** — `Reward.status` can be `claimed` and `claimed_at` exists, but no `POST /rewards/{id}/claim` is in the catalog.

## Users / profile

- **Avatar upload pipeline** — `User.avatar_url` is read-only today. The field is on the `User` response but **not** in `ProfileUpdate` (`contract/user.py:56-67`), so `PATCH /me` rejects it under `StrictModel`. No file-upload endpoint either.
- **Account deletion** — no endpoint; DB cascades would work but UX is absent.

## Teams

- **Team disband / delete** — leader cannot leave; no delete endpoint. Teams exist forever once created.
- **Transfer leadership** — no endpoint.

## Tasks

- **Per-step progress endpoint** — `TaskStep.done` has no direct transition endpoint. Today only bulk `submit` updates progress.
- **Task creation via API** — task defs are seeded only; no admin CRUD.

## Content / news

- **News creation via API** — seeded only.

## Platform / infra

- **Feature flags / A/B** — none.
- **Push notifications** — none.
- **Offline / service worker** — none.
- **Monitoring / metrics / error reporting** — none set up in code.
- **Rate limiting** — none on `POST /auth/google` or any other endpoint.

## Localization

- **Multi-locale** — single zh-TW locale; see `09-localization.md`.
