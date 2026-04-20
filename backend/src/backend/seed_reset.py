"""Truncate seed-owned tables so the next `just seed` re-creates them.
Refuses to run in production.

Tables truncated (CASCADE handles FK fan-out):
  * task_defs — task definitions
  * news_items — news feed
  * users — every user (cascades to teams, team_memberships, join_requests,
    rewards, task_progress, etc.)

This is intentionally a hard reset: a partial reset (e.g. only DEMO_USERS)
would leave dangling teams from prior runs and isn't worth the complexity
for a dev-only recipe.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from backend.config import get_settings
from backend.db.engine import get_engine


async def run() -> None:
    settings = get_settings()
    if settings.app_env == "prod":
        raise SystemExit("seed-reset refused: APP_ENV=prod")
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE task_defs, news_items, users RESTART IDENTITY CASCADE"))
    print("seed-reset: done")


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(run())
