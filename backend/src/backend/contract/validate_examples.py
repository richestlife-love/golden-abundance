"""Smoke test: validate every JSON fixture against its declared Pydantic
model. Exits 0 if every fixture parses cleanly, non-zero otherwise.

Wired to `just contract-validate`. Subsequent tasks register fixtures
in the FIXTURES mapping below.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from pydantic import BaseModel, TypeAdapter

from backend.contract.common import Paginated
from backend.contract.news import NewsItem
from backend.contract.rewards import Reward
from backend.contract.user import ProfileCreate, User

FIXTURES_DIR = Path(__file__).parent / "examples"

# Map each fixture filename to the adapter used to validate it.
# Adapter is either a Pydantic model class (for single-object fixtures)
# or a TypeAdapter (for compound types like list[Reward] or
# Paginated[NewsItem]).
FIXTURES: dict[str, Any] = {
    "user.json": User,
    "profile_create.json": ProfileCreate,
    "rewards_list.json": TypeAdapter(list[Reward]),
    "news_list.json": TypeAdapter(Paginated[NewsItem]),
}


def _validate_one(adapter: Any, data: Any) -> None:
    if isinstance(adapter, type) and issubclass(adapter, BaseModel):
        adapter.model_validate(data)
    elif isinstance(adapter, TypeAdapter):
        adapter.validate_python(data)
    else:
        raise RuntimeError(f"Unknown adapter type: {type(adapter).__name__}")


def main() -> int:
    if not FIXTURES:
        print("validate-examples: no fixtures registered yet.")
        return 0
    if not FIXTURES_DIR.is_dir():
        print(f"FIXTURES_DIR missing: {FIXTURES_DIR}", file=sys.stderr)
        return 1
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
        except Exception as exc:  # noqa: BLE001
            print(f"FAIL     {fname}: {exc}")
            failures += 1
            continue
        print(f"OK       {fname}")
    total = len(FIXTURES)
    print(f"\n{total - failures}/{total} fixtures valid.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
