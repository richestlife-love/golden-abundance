# 04 — Frontend-Derived Values

Values and logic the client computes on top of the API contract. Every item here is a product rule living **only on the frontend** — any change is a code change.

## `getEffectiveStatus(task, allTasks)` — client re-derives `locked`

Defined in `frontend/src/utils.ts`. Computes `completedIds` from `allTasks`, then returns `locked` + `unmet` list if any id in `task.requires` is missing; otherwise returns the server's status unchanged.

> ⚠️ **Duplicates server logic.** `services/task.py:125-135` derives `locked`/`expired` and emits it as `Task.status`. `getEffectiveStatus` re-derives `locked` locally anyway — redundant. Cleanup candidate: drop the client derivation and trust the server's `Task.status`.

## `daysUntil(dueAt)` — ceil-days client-side

`Math.ceil((due - now) / 86400000)`; negative = past due; null when no `due_at`.

> ⚠️ Uses local time-of-day — the value can flip between refreshes near midnight.

## `totalPoints` — client-derived star points

```
totalPoints = sum(t.points for t in tasks if t.status === "completed")
```

Computed independently in `HomeScreen.tsx:34` (`totalPoints`), `MyScreen.tsx:38` (`totalPoints`), `RewardsScreen.tsx:21` (`totalPoints`), and `LeaderboardScreen.tsx:45` (named `myPoints`, same formula).

> ⚠️ No backend `user.points` field. Duplicated across 4 screens.

## Tiers (milestones) — frontend-only

Defined in `MyRewards.tsx:27`, mirrored in `HomeScreen.tsx:38`:

| Name | Required pts | Icon | Color |
|---|---|---|---|
| 新手志工 | 100 | leaf | #8AD4B0 |
| 熱心志工 | 500 | star | #fed234 |
| 服務先鋒 | 1000 | medal | #FFC170 |
| 金牌志工 | 2000 | crown | #B8A4E3 |

Derived values: `unlockedCount`, `nextTier`, `prevRequired`, `reachedMax`, `progressPct`. HomeScreen shows "志工寶寶" as the default label when `totalPoints < 100`.

> ⚠️ Thresholds are product rules with no backend mirror. Duplicated between two screens.

## `urgent` window — hardcoded 7-day threshold

```
urgent = status === "todo" && daysLeft in (0, 7]
```

Used in `TaskCard.tsx:41` and `TaskDetailScreen.tsx:61`.

> ⚠️ Business rule with no backend mirror.

## TeamCard fallbacks — *synthetic* data when backend omits

`TeamCard.tsx:130–155` produces fake on-screen numbers when the per-team
point fields aren't supplied:

| Field | Fallback |
|---|---|
| `memberPoints(name)` | deterministic hash in 400–1600 range |
| `teamPoints` | formula: `total * 180 + 240` |
| `teamRank` | `team.rank ?? 3` |
| `weekPoints` | `Math.round(teamPoints * 0.18)` |

> ⚠️ These produce **fake** numbers on screen. The `team.points / team.week_points / team.cap` fields were removed from the `Team` contract in the 2026-04-22 review (M6) — the authoritative source is now `GET /leaderboard/teams`, which returns `TeamLeaderboardEntry { points, week_points, rank }`. Frontend should read points from that endpoint and drop the synthetic fallbacks entirely.

## Other client-only product rules

- **Task filter tabs** (`TasksScreen.tsx`) — `待完成 / 全部 / 已完成 / 已過期 / 未解鎖`. `active = todo | in_progress | locked`.
- **Status chip labels** — `已完成 / 進行中 / 已過期 / 未解鎖`. UI-only mapping from `status`.
- **Simplified → traditional tag rewrite** — `TaskDetailScreen.tsx:60` rewrites `社区 → 社區` before display. `TaskCard.tsx:42` uses `t.tag` only to select an icon and never renders the tag text, so the remap is currently detail-screen-only by necessity — not an inconsistency with TaskCard, but a gap if tag text is ever added to the card. See `09-localization.md`.
- **Route guards** — `/` redirects to `/home` if `profile_complete`, `/welcome` if not, `/sign-in` if no token. Defined in `frontend/src/routes/index.tsx` and `sign-in.tsx` `beforeLoad`.

## Things to flag in requirements review

1. **Client-side `locked` derivation** duplicates contract — confirm which layer is authoritative.
2. **`totalPoints` client-derived** across 4 screens with no backend field.
3. **Tier thresholds (100/500/1000/2000)** are product rules that live only on frontend.
4. **TeamCard synthetic numbers** when backend omits — decide on canonical source.
5. **`urgent` 7-day window** hardcoded in two screens.
6. **`社区 → 社區` remap** only on detail screen — safe today because TaskCard never shows tag text, but would become an inconsistency if the card adds a tag label.
7. **`daysUntil` local-time drift** near midnight.
