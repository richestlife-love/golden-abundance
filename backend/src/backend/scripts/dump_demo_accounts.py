"""Dump DEMO_USERS as JSON for the frontend's sign-in picker.

Output shape: [{"email": "...", "label": "金杰 (Jet Kan)"}, ...]

Frontend reads this JSON from frontend/src/dev/demo-accounts.json
(checked in; regenerated when DEMO_USERS changes). Single source of
truth lives in seed.py.
"""

from __future__ import annotations

import json
import sys

from backend.seed import DEMO_USERS


def render_label(spec: dict[str, str]) -> str:
    en = spec.get("en_name")
    return f"{spec['zh_name']} ({en})" if en else spec["zh_name"]


def main() -> int:
    payload = [{"email": spec["email"], "label": render_label(spec)} for spec in DEMO_USERS]
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
