# 10 — Deferred / Out-of-Scope

Intentional gaps in the current codebase. Listing them explicitly so reviewers know they're **not** oversights.

## Auth

- **Server-side token revocation / denylist** — Supabase manages access + refresh tokens; our backend verifies signatures + expiry but does not maintain a per-user revoke list. A compromised token is valid until its natural expiry or until a Supabase-side signing-key rotation propagates (`PyJWKClient.lifespan=3600`). Acceptable at launch; revisit if abuse or credential-compromise becomes a real concern.
- **Rate limiting on Supabase Auth endpoints** — Supabase enforces its own defaults (60 sign-ups/hour on the free plan). No additional ingress throttling on `api.jinfuyou.app`.
- **Row-Level Security** — deliberately off. FastAPI is the sole DB client via the `app_backend` Postgres role (`BYPASSRLS`). Revisit if Supabase Realtime or non-FastAPI direct-DB access is ever added.

## Rewards

- **Claim endpoint** — `Reward.status` can be `claimed` and `claimed_at` exists, but no `POST /rewards/{id}/claim` is in the catalog.

## Users / profile

- **Avatar upload pipeline** — `User.avatar_url` is read-only today. The field is on the `User` response but **not** in `ProfileUpdate` (`contract/user.py:56-67`), so `PATCH /me` rejects it under `StrictModel`. No file-upload endpoint either.
- **Account deletion** — no endpoint; DB cascades would work but UX is absent.

## Teams

- **Team disband / delete** — leader cannot leave; no delete endpoint. Teams exist forever once created.
- **Transfer leadership** — no endpoint.
- **Team join via T3 challenge flow** — disabled pending a real teams-search UI. `/tasks/T3/start` throws `notFound()` and the MyScreen "搜尋加入" CTA shows a "coming soon" toast, so the app has no live caller for `POST /teams/{id}/join-requests` today. Backend endpoints (`GET /teams`, `GET /teams/{id}`, the join-request POST) all work; the frontend just can't reach them until `TeamForm` is wired to `teamsInfiniteQueryOptions` or dedicated `/teams` list/detail routes ship.

## Tasks

- **Per-step progress endpoint** — `TaskStep.done` has no direct transition endpoint. Today only bulk `submit` updates progress.
- **Task creation via API** — task defs are seeded only; no admin CRUD.

## Content / news

- **News creation via API** — seeded only.

## Platform / infra

- **Feature flags / A/B** — none.
- **Push notifications** — none.
- **Offline / service worker** — none.
- **Distributed tracing / structured logs / session replay** — Sentry error reporting (backend + frontend) shipped in Phase 7b (`backend/src/backend/server.py` + `frontend/src/main.tsx`); source-map uploads configured via `@sentry/vite-plugin`. No distributed tracing spans beyond the SDK's default `traces_sample_rate=0.1`, no structured logs beyond platform stdout, no Sentry Replay.
- **Rate limiting** — none on backend endpoints beyond Supabase Auth's built-in throttles.

## Localization

- **Multi-locale** — single zh-TW locale; see `09-localization.md`.
