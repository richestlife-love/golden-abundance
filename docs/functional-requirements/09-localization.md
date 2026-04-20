# 09 — Localization

## Current state

Single-locale **zh-TW**. Chinese strings are hardcoded across screens — no i18n framework.

## Affected surface

- Status labels, tab names, toast messages, form copy — all literals in `.tsx` files.
- Backend seed contains Chinese titles / descriptions.
- Category / tag enums are Chinese strings in the DB schema (`探索 / 社区 / 陪伴` for tasks; `公告 / 活動 / 通知` for news).

## Known inconsistency

- Contract enum uses simplified `社区`.
- `TaskDetailScreen.tsx:60` rewrites to traditional `社區` for display.
- `TaskCard` shows `社区` as-is.

Two options, both need a decision:
1. Normalize everywhere to traditional `社區` (migration + schema change).
2. Keep the mapping as-is but centralize it in a single helper.

## If i18n is in scope

This becomes a significant refactor:

- Extract all literals to a message catalog (e.g. `react-i18next` or a lighter `useTranslate`).
- Parameterize backend-returned display labels (`category` in `news_items`, `tag` in `task_defs`) — today they're display-ready zh-TW strings. The other enum columns (`task_progress.status`, `rewards.status`, `join_requests.status`) are locale-neutral codes and stay as-is.
- Decide whether tag / category values are IDs (locale-agnostic) with localized labels, or localized strings.
- Internationalize date formatting (currently `t.due_at.slice(0,10)` assumes ISO).
- Phone country codes / country list — `country: "TW"` is an ISO code, so safer already.

**Recommendation for the doc**: mark i18n out-of-scope for v1 and plan it as a v2 migration.
