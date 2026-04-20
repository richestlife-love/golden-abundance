# Functional Requirements

Assembled from a codebase walk-through on 2026-04-21. Each section is self-contained — read in order for a top-down picture, or jump to a section by topic.

## Index

1. [Seed data](./01-seed-data.md)
2. [DB schema](./02-db-schema.md)
3. [API contract](./03-api-contract.md)
4. [Frontend-derived values](./04-frontend-derivations.md)
5. [Roles & permissions matrix](./05-roles-permissions.md)
6. [Entity rules](./06-entity-rules.md)
7. [User journeys](./07-user-journeys.md)
8. [Error semantics](./08-error-semantics.md)
9. [Localization](./09-localization.md)
10. [Deferred scope](./10-deferred-scope.md)

## Authoritative sources

When a fact in this doc and one of these sources disagree, the source wins.

- **API surface** — `backend/src/backend/contract/endpoints.md`
- **Contract schemas** — `backend/src/backend/contract/*.py`
- **DB schema** — `backend/src/backend/db/models.py`
- **Business logic** — `backend/src/backend/services/*.py`
- **Route guards** — `frontend/src/routes/_authed.tsx`, `frontend/src/routes/index.tsx`
- **Cache keys** — `frontend/src/queries/keys.ts`

## Existing design docs in-repo

Skim these before writing requirements from scratch — a lot of the work is already captured.

- `docs/superpowers/specs/2026-04-19-phase-2-api-contract-design.md` — API shape, auth, status-code conventions
- `docs/superpowers/specs/2026-04-20-phase-3-routing-design.md` — route guards
- `docs/superpowers/specs/2026-04-20-phase-4-frontend-wiring-design.md` — query/mutation wiring
- `docs/production-launch-plan.md` — launch scope
- `docs/superpowers/plans/*.md` — phased implementation plans

## Tests as behavior spec

Test suites under `backend/tests/` and `frontend/src/**/__tests__/` are the authoritative behavior spec — grep them before writing new acceptance criteria. MSW handlers at `frontend/src/test/msw/handlers.ts` document the mock API surface the frontend tests assume.

## Open product decisions

Each FR doc describes what the code does today. These are the points where the current implementation already encodes a decision that would benefit from explicit PM sign-off before v1 ships. Grouped by theme; format is **current behavior → open question**.

### Launch readiness

- **Google auth is stubbed** — `auth/google_stub.py` treats any valid email as the authenticated user; real JWKS verification is Phase 6. → Hard gate before external exposure, or acceptable for a gated invite launch?
- **`profile_complete` is frontend-only** — only `_authed.tsx` gates business endpoints; backend `current_user` checks only the bearer token. → Close the gap before launch, or document as a known internal-use gap?
- **Rate limiting** — none on `POST /auth/google` or anywhere. → When does this land?
- **Account deletion / team disband / leadership transfer** — none exist. → Acceptable for v1, or does at least one need to ship?

### Rewards & recognition

- **T3 reward experience** — 120 pts but `bonus=None`, so no reward card is created after the team completes the challenge. → Should T3 have a bonus (徽章 / 紀念品) to celebrate the milestone, or is points-only the intended moment?
- **Claim flow** — `Reward.status` supports `earned → claimed` and `claimed_at` exists, but no `POST /rewards/{id}/claim` endpoint. Every reward stays forever `earned`. → Is "claiming" a real redemption action (event pickup, QR scan), or should the vestigial fields be removed?
- **Tier thresholds** — 新手志工 / 熱心志工 / 服務先鋒 / 金牌志工 at 100/500/1000/2000 live only in `MyRewards.tsx` and `HomeScreen.tsx`. → Keep frontend-owned (ops files a FE change to tune), or promote to backend config?
- **Reward sort order** — `/rewards` screen sort key not specified. → Canonical order (earn time desc? bonus size?)?

### Teams & join flow

- **Team search UI** — `GET /teams`, `GET /teams/{id}`, `POST /teams/{id}/join-requests` exist on the backend, but no `/teams` list/detail routes on the frontend. Only in-app entry to creating a join request is the T3 challenge's hard-coded-demo `TeamForm`. → v1 feature, or permanently "T3-only team matching"?
- **Rejected-request cooldown** — join-request guards only check `status='pending'`, so a user can resubmit immediately after rejection. → Add cooldown / retry cap / per-team block?
- **Team auto-name** — every led team is auto-named `"{leader_name}的團隊"` on profile completion. → Final default, or prompt leader to name it on first `/me` visit?
- **Per-team cap override** — `teams.cap` column supports non-6 caps; no UI. → Will leaders ever edit cap? Who sets cap for T3-aligned teams?
- **`teams.alias` vs `name`** — both are searchable (`services/team.py:173`) and `alias` is user-overridable while `name` is auto-generated. → Is the dual-field model intentional long-term, or should `alias` replace `name` once set?
- **Team lifecycle** — never deleted, leader can't leave own team, no leadership transfer. → Acceptable forever, or is at least transfer-leadership in v2?
- **TeamCard synthetic fallbacks** — when `team.points / rank / week_points` are null, `TeamCard.tsx:130–155` fabricates numbers (deterministic hash in 400–1600 range for member points; formula for team points). **Users see fake data.** → Backend populates these fields, or UI shows a genuine empty state?

### Leaderboard

- **`period` semantics** — `period ∈ {week, month, all_time}` widens the `points` window, but `week_points` on each entry is always trailing-7d regardless of `period`. → (a) rename `week_points → recent_points` and lean into the always-7d model, (b) make it track the selected period, or (c) drop the field outside week view?
- **Tie-breaking** — no documented deterministic order when users/teams share points. → By earlier `created_at`? Display-ID? Alphabetical?
- **Privacy / opt-out** — every profile-complete user appears on the user leaderboard. → Can users hide themselves? Is leaderboarding opt-in or opt-out?

### Tasks

- **Task-step tracking** — `TaskStep.done` is in the contract but no endpoint updates individual steps; today steps are display-only and `submit` is the only transition. → Display-only forever, or is per-step tick-off a future interaction?
- **`progress` on non-challenge tasks** — backend only sets `in_progress` for challenge tasks. Non-challenge tasks jump `todo → completed` in one step; `progress` is effectively 0 or 1. MSW fixture shows T2 `progress=0.4` but that's test-only. → Keep the field uniform across task types, or remove for form-submit tasks?
- **Expired task submission is silently permitted** — `submit_task` (`services/task.py:198–234`) does not check `due_at`; a user can complete an "expired" task and be marked `completed`. → Should submit on expired tasks return 409/412, or stay permissive so late completions still count?
- **`description` vs `summary`** — both fields exist on `Task`. → What's the display-surface difference (card vs detail? teaser vs full?)?
- **Urgent window** — hardcoded 7-day threshold (`TaskCard.tsx:41`, `TaskDetailScreen.tsx:61`) driving the visual "urgent" state. → Is 7 correct? Should it vary by tag or bonus size?
- **Task visibility** — every profile-complete user sees every task. → Onboarding gating (new users see only T1), or keep flat?

### Content & ops

- **Admin CRUD for tasks/news** — seed-only; any edit requires a redeploy. → Acceptable forever, or v1 needs a basic CMS?
- **Tag canon** — DB stores simplified `社区`; `TaskDetailScreen.tsx:60` rewrites to traditional `社區` at display time; `TaskCard` never renders the tag text. → Normalize to traditional in the DB (and run a migration), or keep the display-time rewrite?
- **Tag extensibility** — task tags `探索/社区/陪伴` and news categories `公告/活動/通知` are VARCHARs (not PG enums), so adding a value is migration-free but every consumer must match. → Governance for new values (who approves, update checklist)?
- **News freshness** — no per-user read state. → Unread badge? "NEW" marker? Last-read timestamp?

### UX & flows

- **Home screen content scope** — currently shows tier progress only. → Featured tasks? Pending-request badge for leaders? Unread-news dot? Upcoming-deadline strip?
- **Empty states** — `/rewards`, `/leaderboard`, `/tasks` when a user has completed nothing. → Placeholder illustration + CTA, or plain-text minimal?
- **Session `returnTo`** — 401 redirect preserves URL, not form state (a mid-edit profile loses input). → Acceptable, or snapshot-and-restore mid-submit forms?
- **Onboarding polish** — `/welcome → ProfileSetupForm → /home` is direct; no guided tour, no first-task highlight. → Is an onboarding layer in v1 scope?

### Profile & account

- **Avatar** — `User.avatar_url` is read-only today (not in `ProfileUpdate`, so `PATCH /me` rejects it). → Defer entirely, writable URL string, or ship a real uploader for v1?
- **Email immutability** — no endpoint changes `User.email`. → Permanent design (OAuth-driven), or add re-link support for users who lose email access?

### Localization

- **Multi-locale roadmap** — single zh-TW, no i18n framework; all strings hardcoded. → Any roadmap to add another locale? If yes, the timing shapes whether to wrap strings now.
- **Date formatting** — `due_at.slice(0,10)` everywhere (ISO date prefix). → Acceptable forever, or format per locale once i18n lands?

## Scope

Functional only. Performance, privacy, audit, and ops concerns are deliberately out of scope here — track those in a separate non-functional-requirements doc when needed.
