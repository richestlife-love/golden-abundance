"""Deterministic `display_id` generation for users and teams.

User display_id: ``U`` + up to 7 [A-Z0-9] derived from the email local
part. Collisions suffix a two-digit counter (01-99); the 100th collision
raises ``RuntimeError``. Matches the regex ``^U[A-Z0-9]{3,7}$`` from the
contract.

Team display_id: ``T-`` + up to 8 [A-Z0-9] from the user's display_id
minus the leading ``U``, with the same 01-99 collision suffix and
``RuntimeError`` on exhaustion. Matches ``^T-[A-Z0-9]{3,10}$``.

Phase-5 caveat: both functions run a SELECT-then-INSERT flow that is
NOT transactional — two concurrent sign-ups with colliding bases can
both pick the same candidate, and the loser hits a unique-constraint
error on insert (surfaces as a 500). Acceptable for single-tenant dev;
Phase 6 should wrap the candidate generation in a retry-on-IntegrityError
loop (or `INSERT ... ON CONFLICT` with a regenerated suffix) before
production sign-ups land.
"""

import re
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import UserRow

_ALNUM = re.compile(r"[^A-Z0-9]")


def _base_from_email(email: str) -> str:
    local = email.split("@", 1)[0].upper()
    base = _ALNUM.sub("", local)[:7]
    if len(base) < 3:
        base = (base + "USR")[:3]
    return base


async def generate_user_display_id(session: AsyncSession, *, email: str) -> str:
    base = _base_from_email(email)
    candidate = f"U{base}"
    result = await session.execute(select(UserRow.display_id))
    taken = {row[0] for row in result.all()}
    if candidate not in taken:
        return candidate
    for n in range(1, 100):
        suffix = f"{n:02d}"
        trimmed_base = base[: max(3, 7 - len(suffix))]
        candidate = f"U{trimmed_base}{suffix}"
        if candidate not in taken:
            return candidate
    raise RuntimeError(f"Could not allocate a user display_id for {email}")


def generate_team_display_id(*, user_display_id: str, used: Iterable[str]) -> str:
    taken = set(used)
    stem = user_display_id.removeprefix("U")[:8]
    candidate = f"T-{stem}"
    if candidate not in taken:
        return candidate
    for n in range(1, 100):
        suffix = f"{n:02d}"
        trimmed = stem[: max(3, 8 - len(suffix))]
        candidate = f"T-{trimmed}{suffix}"
        if candidate not in taken:
            return candidate
    raise RuntimeError(f"Could not allocate a team display_id for {user_display_id}")
