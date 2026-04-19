"""Smoke test: validate every JSON fixture against its declared Pydantic
model, and assert a handful of negative cases to prove rejection works.
Exits 0 if every fixture parses cleanly and every negative check
rejects as expected, non-zero otherwise.

Wired to `just contract-validate`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from pydantic import BaseModel, TypeAdapter, ValidationError

from backend.contract.auth import AuthResponse, GoogleAuthRequest
from backend.contract.common import Paginated
from backend.contract.news import NewsItem
from backend.contract.rank import TeamRankEntry, UserRankEntry
from backend.contract.rewards import Reward
from backend.contract.task import (
    InterestFormBody,
    SubmitBody,
    Task,
    TaskSubmissionResponse,
    TicketFormBody,
)
from backend.contract.team import (
    MeProfileCreateResponse,
    MeTeamsResponse,
    Team,
)
from backend.contract.user import ProfileCreate, User

FIXTURES_DIR = Path(__file__).parent / "examples"

# Map each fixture filename to the adapter used to validate it.
# Adapter is either a Pydantic model class (for single-object fixtures)
# or a TypeAdapter (for compound types like list[Reward] or
# Paginated[NewsItem]).
FIXTURES: dict[str, Any] = {
    "auth_google_request.json": GoogleAuthRequest,
    "auth_google_response.json": AuthResponse,
    "user.json": User,
    "profile_create.json": ProfileCreate,
    "rewards_list.json": TypeAdapter(list[Reward]),
    "news_list.json": TypeAdapter(Paginated[NewsItem]),
    "team_as_leader.json": Team,
    "team_as_member.json": Team,
    "rank_users_week.json": TypeAdapter(Paginated[UserRankEntry]),
    "rank_teams_week.json": TypeAdapter(Paginated[TeamRankEntry]),
    "task_interest.json": Task,
    "task_team_challenge.json": Task,
    "interest_form_submit.json": InterestFormBody,
    "ticket_form_submit.json": TicketFormBody,
    "task_submission_response.json": TaskSubmissionResponse,
    "task_submission_response_no_reward.json": TaskSubmissionResponse,
    "me_profile_create_response.json": MeProfileCreateResponse,
    "me_teams_response.json": MeTeamsResponse,
}


def _validate_one(adapter: Any, data: Any) -> None:
    if isinstance(adapter, type) and issubclass(adapter, BaseModel):
        adapter.model_validate(data)
    elif isinstance(adapter, TypeAdapter):
        adapter.validate_python(data)
    else:
        raise RuntimeError(f"Unknown adapter type: {type(adapter).__name__}")


# Each entry: (label, callable that must raise ValidationError).
# Proves the models reject malformed inputs, not just accept good ones.
_SUBMIT_ADAPTER = TypeAdapter(SubmitBody)
NEGATIVE_CHECKS: list[tuple[str, Any]] = [
    (
        "User rejects malformed UUID",
        lambda: User.model_validate(
            {
                "id": "not-a-uuid",
                "display_id": "UJETKAN",
                "email": "jet@example.com",
                "name": "Jet",
                "profile_complete": True,
                "created_at": "2026-04-01T00:00:00Z",
            }
        ),
    ),
    (
        "User rejects extra fields (extra='forbid')",
        lambda: User.model_validate(
            {
                "id": "7f7a9b10-1d3a-4c2e-9e81-1b3e8a2d0001",
                "display_id": "UJETKAN",
                "email": "jet@example.com",
                "name": "Jet",
                "profile_complete": True,
                "created_at": "2026-04-01T00:00:00Z",
                "unexpected_field": "nope",
            }
        ),
    ),
    (
        "SubmitBody rejects unknown form_type discriminator",
        lambda: _SUBMIT_ADAPTER.validate_python({"form_type": "bogus", "name": "X"}),
    ),
]


def _run_fixture_checks() -> int:
    failures = 0
    for fname, adapter in FIXTURES.items():
        path = FIXTURES_DIR / fname
        if not path.is_file():
            print(f"MISSING  {fname}")
            failures += 1
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            _validate_one(adapter, data)
        except (json.JSONDecodeError, ValidationError, OSError) as exc:
            print(f"FAIL     {fname}: {exc}")
            failures += 1
            continue
        print(f"OK       {fname}")
    return failures


def _run_negative_checks() -> int:
    failures = 0
    for label, call in NEGATIVE_CHECKS:
        try:
            call()
        except ValidationError:
            print(f"OK       (reject) {label}")
            continue
        print(f"FAIL     (reject) {label}: did not raise ValidationError")
        failures += 1
    return failures


def main() -> int:
    if not FIXTURES_DIR.is_dir():
        print(f"FIXTURES_DIR missing: {FIXTURES_DIR}", file=sys.stderr)
        return 1
    fixture_failures = _run_fixture_checks()
    negative_failures = _run_negative_checks()
    total_fixtures = len(FIXTURES)
    total_negatives = len(NEGATIVE_CHECKS)
    print(
        f"\n{total_fixtures - fixture_failures}/{total_fixtures} fixtures valid, "
        f"{total_negatives - negative_failures}/{total_negatives} negative checks passed."
    )
    return 1 if (fixture_failures or negative_failures) else 0


if __name__ == "__main__":
    sys.exit(main())
