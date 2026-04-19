# Phase 2 API Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the Phase 2 API contract deliverable — Pydantic 2 models, a fixture-validation smoke test, example JSON fixtures, a developer README, and a human-readable endpoint catalog — all under `backend/src/backend/contract/`, wired to a `just contract-validate` recipe.

**Architecture:** One Python subpackage inside the existing `backend` package (src-layout, `uv_build`). One module per domain (`user`, `task`, `team`, `rank`, `rewards`, `news`, `auth`, plus shared `common.py`). A flat `validate_examples.py` script plus `examples/*.json` fixtures form the test suite — no pytest, no unit tests; if the fixtures parse cleanly against their Pydantic models, the contract is internally consistent. The justfile recipe runs the validator.

**Tech Stack:** Python 3.14 (per existing `backend/pyproject.toml`), Pydantic 2, `uv` for dependency management, `uv_build` as the backend, `just` as the task runner.

**Spec:** `docs/superpowers/specs/2026-04-19-api-contract-design.md`.

---

## File plan

Files created or modified by this plan:

| Path | Action | Contents |
|---|---|---|
| `backend/pyproject.toml` | modify | add `pydantic>=2` to dependencies |
| `backend/src/backend/contract/__init__.py` | create | re-export the full public surface |
| `backend/src/backend/contract/common.py` | create | `UserRef`, `TeamRef`, `Paginated[T]` |
| `backend/src/backend/contract/user.py` | create | `User`, `ProfileCreate`, `ProfileUpdate` |
| `backend/src/backend/contract/rewards.py` | create | `Reward` |
| `backend/src/backend/contract/news.py` | create | `NewsItem` |
| `backend/src/backend/contract/team.py` | create | `Team`, `JoinRequest`, `TeamUpdate`, `MeTeamsResponse`, `MeProfileCreateResponse` |
| `backend/src/backend/contract/rank.py` | create | `UserRankEntry`, `TeamRankEntry`, `RankPeriod` |
| `backend/src/backend/contract/task.py` | create | `Task`, `TaskStep`, `TeamChallengeProgress`, `InterestFormBody`, `TicketFormBody`, `SubmitBody`, `TaskSubmissionResponse` (union uses `\|` not `Union[...]`) |
| `backend/src/backend/contract/auth.py` | create | `GoogleAuthRequest`, `AuthResponse`, `TokenClaims` |
| `backend/src/backend/contract/validate_examples.py` | create | smoke test that validates every fixture |
| `backend/src/backend/contract/examples/*.json` | create | 14 fixture files |
| `backend/src/backend/contract/README.md` | create | consumer guide |
| `backend/src/backend/contract/endpoints.md` | create | endpoint catalog |
| `justfile` | modify | add `contract-validate` recipe |

All commands are run from the repository root (`/Users/Jet/Developer/golden-abundance-lite`) unless stated otherwise.

---

## Task 1: Add `pydantic>=2` to the backend

**Files:**
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Add the dependency with `uv add`**

Run:
```bash
(cd backend && uv add 'pydantic>=2')
```

This edits `backend/pyproject.toml`'s `dependencies` array, creates `backend/.venv/` if absent, resolves, and writes `backend/uv.lock`.

- [ ] **Step 2: Verify pyproject.toml update**

Run:
```bash
cat backend/pyproject.toml
```

Expected: `dependencies` now contains `"pydantic>=2"`. Example:
```toml
dependencies = [
    "pydantic>=2",
]
```

- [ ] **Step 3: Verify pydantic is importable**

Run:
```bash
(cd backend && uv run python -c 'import pydantic; print(pydantic.VERSION)')
```

Expected: prints a version like `2.x.y`. No traceback.

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock
git commit -m "$(cat <<'EOF'
contract: add pydantic>=2 backend dependency

Needed for the Phase 2 API contract models.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Contract package skeleton + validator + justfile recipe

Create the empty package, the validator script scaffold (empty `FIXTURES` map), and the `just contract-validate` recipe. After this task you can run the recipe and see `0/0 fixtures valid.`

**Files:**
- Create: `backend/src/backend/contract/__init__.py`
- Create: `backend/src/backend/contract/examples/.gitkeep`
- Create: `backend/src/backend/contract/validate_examples.py`
- Modify: `justfile`

- [ ] **Step 1: Create the empty package init**

Write `backend/src/backend/contract/__init__.py`:
```python
"""Phase 2 API contract — see `backend/src/backend/contract/README.md`.

Re-exports are populated in Task 11 once the per-domain modules exist.
"""
```

- [ ] **Step 2: Create the examples directory**

Create `backend/src/backend/contract/examples/.gitkeep` (empty file). This ensures git tracks the directory until real fixtures land.

```bash
mkdir -p backend/src/backend/contract/examples
touch backend/src/backend/contract/examples/.gitkeep
```

- [ ] **Step 3: Create `validate_examples.py`**

Write `backend/src/backend/contract/validate_examples.py`:
```python
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

FIXTURES_DIR = Path(__file__).parent / "examples"

# Map each fixture filename to the adapter used to validate it.
# Adapter is either a Pydantic model class (for single-object fixtures)
# or a TypeAdapter (for compound types like list[Reward] or
# Paginated[NewsItem]).
FIXTURES: dict[str, Any] = {}


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
```

- [ ] **Step 4: Add the justfile recipe**

Edit `justfile`. The current file ends after the `tunnel` recipe; append a new recipe at the end:

```justfile

# Validate example JSON fixtures against the Pydantic contract models
contract-validate:
    cd backend && uv run python -m backend.contract.validate_examples
```

Result file:
```justfile
default: serve

# Serve the design prototype on http://localhost:{{port}}
serve port="8000":
    uv run --no-project python -m http.server {{port}} --directory frontend

# Expose local port 8000 (https) via a reserved ngrok hostname
tunnel:
    ngrok http --url=subvitalized-occupative-katelyn.ngrok-free.dev --scheme=https 8000

# Validate example JSON fixtures against the Pydantic contract models
contract-validate:
    cd backend && uv run python -m backend.contract.validate_examples
```

- [ ] **Step 5: Run the validator**

Run:
```bash
just contract-validate
```

Expected output:
```
validate-examples: no fixtures registered yet.
```
Exit code: 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/backend/contract/__init__.py \
        backend/src/backend/contract/examples/.gitkeep \
        backend/src/backend/contract/validate_examples.py \
        justfile
git commit -m "$(cat <<'EOF'
contract: scaffold package, validator, and just recipe

Empty __init__.py, validate_examples.py with empty FIXTURES, and a
`just contract-validate` recipe. Per-domain modules land in subsequent
tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `common.py` — shared primitives

Creates `UserRef`, `TeamRef`, and the generic `Paginated[T]`. These are inner types used by other modules and therefore have no standalone fixtures; they get exercised by downstream tasks' fixtures.

**Files:**
- Create: `backend/src/backend/contract/common.py`

- [ ] **Step 1: Create `common.py`**

Write `backend/src/backend/contract/common.py`:
```python
"""Shared primitives used across contract entities.

`UserRef` / `TeamRef` are thin embeddings used inside other response
models. `Paginated[T]` is the cursor-based list envelope.
"""
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class UserRef(BaseModel):
    """Thin user embedding (id + display_id + name + avatar_url)."""
    model_config = ConfigDict(extra="forbid")

    id: UUID
    display_id: str
    name: str
    avatar_url: str | None = None


class TeamRef(BaseModel):
    """Thin team embedding for leaderboard entries and search results."""
    model_config = ConfigDict(extra="forbid")

    id: UUID
    display_id: str
    name: str
    topic: str
    leader: UserRef


class Paginated(BaseModel, Generic[T]):
    """Cursor-paginated list envelope.

    `next_cursor` is the cursor to pass on the next call; ``None`` means
    no more pages. No `total` field — add later if a screen needs it.
    """
    model_config = ConfigDict(extra="forbid")

    items: list[T]
    next_cursor: str | None = None
```

- [ ] **Step 2: Verify the module imports cleanly**

Run:
```bash
(cd backend && uv run python -c "from backend.contract.common import UserRef, TeamRef, Paginated; print('ok')")
```

Expected: `ok`.

- [ ] **Step 3: Run validator (still 0 fixtures)**

Run:
```bash
just contract-validate
```

Expected: `validate-examples: no fixtures registered yet.` Exit 0.

- [ ] **Step 4: Commit**

```bash
git add backend/src/backend/contract/common.py
git commit -m "$(cat <<'EOF'
contract: add common primitives (UserRef, TeamRef, Paginated)

Thin user/team embeddings and the generic cursor-paginated list envelope.
Exercised transitively by downstream fixtures.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `user.py` + fixtures

**Files:**
- Create: `backend/src/backend/contract/user.py`
- Create: `backend/src/backend/contract/examples/user.json`
- Create: `backend/src/backend/contract/examples/profile_create.json`
- Modify: `backend/src/backend/contract/validate_examples.py` — register `User` and `ProfileCreate`

- [ ] **Step 1: Write `examples/user.json`**

Write `backend/src/backend/contract/examples/user.json`:
```json
{
  "id": "7f7a9b10-1d3a-4c2e-9e81-1b3e8a2d0001",
  "display_id": "UJETKAN",
  "email": "jet@example.com",
  "zh_name": "簡傑特",
  "en_name": "Jet Kan",
  "nickname": "Jet",
  "name": "簡傑特",
  "phone": "912345678",
  "phone_code": "+886",
  "line_id": "jetkan",
  "telegram_id": null,
  "country": "台灣",
  "location": "台北",
  "avatar_url": null,
  "profile_complete": true,
  "created_at": "2026-04-01T10:30:00Z"
}
```

- [ ] **Step 2: Write `examples/profile_create.json`**

Write `backend/src/backend/contract/examples/profile_create.json`:
```json
{
  "zh_name": "簡傑特",
  "en_name": "Jet Kan",
  "nickname": "Jet",
  "phone": "912345678",
  "phone_code": "+886",
  "line_id": "jetkan",
  "telegram_id": null,
  "country": "台灣",
  "location": "台北"
}
```

- [ ] **Step 3: Register both fixtures in `validate_examples.py`**

Edit `backend/src/backend/contract/validate_examples.py`. Add an import and two entries in `FIXTURES`:

```python
from pydantic import BaseModel, TypeAdapter

from backend.contract.user import ProfileCreate, User

FIXTURES_DIR = Path(__file__).parent / "examples"

FIXTURES: dict[str, Any] = {
    "user.json": User,
    "profile_create.json": ProfileCreate,
}
```

(Preserve the rest of the file; only the import and `FIXTURES` dict change in this task.)

- [ ] **Step 4: Run validator; expect ImportError**

Run:
```bash
just contract-validate
```

Expected: traceback ending with `ModuleNotFoundError: No module named 'backend.contract.user'`. Non-zero exit.

- [ ] **Step 5: Create `user.py`**

Write `backend/src/backend/contract/user.py`:
```python
"""User shapes: full profile response and profile create/update bodies.

Field derivation rules (server-authoritative):
  * `name`: zh_name if set, else nickname, else email-local-part.
  * `profile_complete`: True once POST /me/profile has run.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class User(BaseModel):
    """Authenticated caller's profile. Returned by GET /me and embedded
    in AuthResponse.user on sign-in."""
    model_config = ConfigDict(extra="forbid")

    id: UUID
    display_id: str = Field(pattern=r"^U[A-Z0-9]{3,7}$")
    email: EmailStr
    zh_name: str | None = None
    en_name: str | None = None
    nickname: str | None = None
    name: str
    phone: str | None = None
    phone_code: str | None = None
    line_id: str | None = None
    telegram_id: str | None = None
    country: str | None = None
    location: str | None = None
    avatar_url: str | None = None
    profile_complete: bool
    created_at: datetime


class ProfileCreate(BaseModel):
    """Request body for POST /me/profile (first-time profile completion).
    Side effect on the backend: user's led team is created in the same
    transaction."""
    model_config = ConfigDict(extra="forbid")

    zh_name: str = Field(min_length=1)
    en_name: str | None = None
    nickname: str | None = None
    phone: str = Field(min_length=1)
    phone_code: str = Field(min_length=1)
    line_id: str | None = None
    telegram_id: str | None = None
    country: str = Field(min_length=1)
    location: str = Field(min_length=1)


class ProfileUpdate(BaseModel):
    """Request body for PATCH /me. Partial update; all fields optional."""
    model_config = ConfigDict(extra="forbid")

    zh_name: str | None = None
    en_name: str | None = None
    nickname: str | None = None
    phone: str | None = None
    phone_code: str | None = None
    line_id: str | None = None
    telegram_id: str | None = None
    country: str | None = None
    location: str | None = None
```

- [ ] **Step 6: Run validator; expect PASS**

Run:
```bash
just contract-validate
```

Expected:
```
OK       user.json
OK       profile_create.json

2/2 fixtures valid.
```
Exit 0.

- [ ] **Step 7: Commit**

```bash
git add backend/src/backend/contract/user.py \
        backend/src/backend/contract/examples/user.json \
        backend/src/backend/contract/examples/profile_create.json \
        backend/src/backend/contract/validate_examples.py
git commit -m "$(cat <<'EOF'
contract: add User, ProfileCreate, ProfileUpdate

User response shape with server-derived `name` and `profile_complete`
gate; ProfileCreate for first-time setup (required: zh_name, phone,
phone_code, country, location); ProfileUpdate for partial edits.

Fixtures validated via just contract-validate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `rewards.py` + fixture

**Files:**
- Create: `backend/src/backend/contract/rewards.py`
- Create: `backend/src/backend/contract/examples/rewards_list.json`
- Modify: `backend/src/backend/contract/validate_examples.py`

- [ ] **Step 1: Write `examples/rewards_list.json`**

Write `backend/src/backend/contract/examples/rewards_list.json`:
```json
[
  {
    "id": "8a9b10c1-2d3e-4f5a-9b8c-1d2e3f4a0001",
    "user_id": "7f7a9b10-1d3a-4c2e-9e81-1b3e8a2d0001",
    "task_id": "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b0002",
    "task_title": "夏季盛會報名",
    "bonus": "限定紀念徽章",
    "status": "earned",
    "earned_at": "2026-04-02T11:00:00Z",
    "claimed_at": null
  }
]
```

- [ ] **Step 2: Register the fixture in `validate_examples.py`**

Edit the imports and `FIXTURES`:

```python
from backend.contract.rewards import Reward
from backend.contract.user import ProfileCreate, User

FIXTURES: dict[str, Any] = {
    "user.json": User,
    "profile_create.json": ProfileCreate,
    "rewards_list.json": TypeAdapter(list[Reward]),
}
```

- [ ] **Step 3: Run validator; expect ImportError**

Run:
```bash
just contract-validate
```

Expected: `ModuleNotFoundError: No module named 'backend.contract.rewards'`. Non-zero exit.

- [ ] **Step 4: Create `rewards.py`**

Write `backend/src/backend/contract/rewards.py`:
```python
"""Reward shapes. Earned when tasks with a non-null `bonus` are completed.

Rewardless tasks (`Task.bonus is None`) do NOT create Reward rows, so
`Reward.bonus` is always non-null by construction.
"""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class Reward(BaseModel):
    """A user's earned (or claimed) reward."""
    model_config = ConfigDict(extra="forbid")

    id: UUID
    user_id: UUID
    task_id: UUID
    task_title: str
    bonus: str
    status: Literal["earned", "claimed"]
    earned_at: datetime
    claimed_at: datetime | None = None
```

- [ ] **Step 5: Run validator; expect PASS**

Run:
```bash
just contract-validate
```

Expected:
```
OK       user.json
OK       profile_create.json
OK       rewards_list.json

3/3 fixtures valid.
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/backend/contract/rewards.py \
        backend/src/backend/contract/examples/rewards_list.json \
        backend/src/backend/contract/validate_examples.py
git commit -m "$(cat <<'EOF'
contract: add Reward

Earned/claimed reward rows, created only for tasks with a non-null bonus.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `news.py` + fixture

**Files:**
- Create: `backend/src/backend/contract/news.py`
- Create: `backend/src/backend/contract/examples/news_list.json`
- Modify: `backend/src/backend/contract/validate_examples.py`

- [ ] **Step 1: Write `examples/news_list.json`**

Write `backend/src/backend/contract/examples/news_list.json`:
```json
{
  "items": [
    {
      "id": "b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c0001",
      "title": "夏季盛會志工招募開跑",
      "body": "5 月 10 日金富有夏季盛會，需要接待、導覽、物資、秩序四大崗位志工。報名截止 4 月 30 日。",
      "category": "公告",
      "image_url": null,
      "published_at": "2026-04-18T09:00:00Z",
      "pinned": true
    },
    {
      "id": "b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c0002",
      "title": "本月星點雙倍週即將開始",
      "body": "4 月 22 – 28 日，所有任務星點 ×2。趕緊邀請夥伴一起組隊衝榜！",
      "category": "活動",
      "image_url": null,
      "published_at": "2026-04-16T09:00:00Z",
      "pinned": false
    },
    {
      "id": "b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c0003",
      "title": "新任務「長者陪伴」已上線",
      "body": "每週六下午安排 2 小時，陪伴社區長者聊天、散步，可獲得 120 星點。",
      "category": "通知",
      "image_url": null,
      "published_at": "2026-04-14T09:00:00Z",
      "pinned": false
    }
  ],
  "next_cursor": null
}
```

- [ ] **Step 2: Register the fixture**

Edit `validate_examples.py`:

```python
from backend.contract.common import Paginated
from backend.contract.news import NewsItem
from backend.contract.rewards import Reward
from backend.contract.user import ProfileCreate, User

FIXTURES: dict[str, Any] = {
    "user.json": User,
    "profile_create.json": ProfileCreate,
    "rewards_list.json": TypeAdapter(list[Reward]),
    "news_list.json": TypeAdapter(Paginated[NewsItem]),
}
```

- [ ] **Step 3: Run validator; expect ImportError**

Run:
```bash
just contract-validate
```

Expected: `ModuleNotFoundError: No module named 'backend.contract.news'`.

- [ ] **Step 4: Create `news.py`**

Write `backend/src/backend/contract/news.py`:
```python
"""News feed shapes. `category` drives the badge colour client-side;
the mapping lives in `frontend/app.jsx` NewsBoard."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NewsItem(BaseModel):
    """A single entry in the home-screen news carousel."""
    model_config = ConfigDict(extra="forbid")

    id: UUID
    title: str
    body: str
    category: Literal["公告", "活動", "通知"]
    image_url: str | None = None
    published_at: datetime
    pinned: bool = False
```

- [ ] **Step 5: Run validator; expect PASS**

Run:
```bash
just contract-validate
```

Expected:
```
OK       user.json
OK       profile_create.json
OK       rewards_list.json
OK       news_list.json

4/4 fixtures valid.
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/backend/contract/news.py \
        backend/src/backend/contract/examples/news_list.json \
        backend/src/backend/contract/validate_examples.py
git commit -m "$(cat <<'EOF'
contract: add NewsItem

Home-screen news feed entries with closed-set `category`
("公告"/"活動"/"通知") and `pinned` flag (sorted pinned DESC,
published_at DESC by the endpoint).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `team.py` + fixtures

**Files:**
- Create: `backend/src/backend/contract/team.py`
- Create: `backend/src/backend/contract/examples/team_as_leader.json`
- Create: `backend/src/backend/contract/examples/team_as_member.json`
- Modify: `backend/src/backend/contract/validate_examples.py`

- [ ] **Step 1: Write `examples/team_as_leader.json`**

The leader's view: `role == "leader"`, `requests` populated.

Write `backend/src/backend/contract/examples/team_as_leader.json`:
```json
{
  "id": "c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d0001",
  "display_id": "T-JETKAN",
  "name": "簡傑特的團隊",
  "alias": null,
  "topic": "尚未指定主題",
  "leader": {
    "id": "7f7a9b10-1d3a-4c2e-9e81-1b3e8a2d0001",
    "display_id": "UJETKAN",
    "name": "簡傑特",
    "avatar_url": null
  },
  "members": [],
  "cap": 6,
  "points": 0,
  "week_points": 0,
  "rank": null,
  "role": "leader",
  "requests": [
    {
      "id": "d4e5f6a7-8b9c-0d1e-2f3a-4b5c6d7e0001",
      "team_id": "c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d0001",
      "user": {
        "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b0011",
        "display_id": "ULINMEI",
        "name": "林詠瑜",
        "avatar_url": null
      },
      "status": "pending",
      "requested_at": "2026-04-18T15:00:00Z"
    }
  ],
  "created_at": "2026-04-01T10:35:00Z"
}
```

- [ ] **Step 2: Write `examples/team_as_member.json`**

The member's view: `role == "member"`, `requests == null`.

Write `backend/src/backend/contract/examples/team_as_member.json`:
```json
{
  "id": "c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d0002",
  "display_id": "T-MING2024",
  "name": "星河守望隊",
  "alias": null,
  "topic": "長者陪伴",
  "leader": {
    "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b0021",
    "display_id": "UMING",
    "name": "周明蓁",
    "avatar_url": null
  },
  "members": [
    {
      "id": "7f7a9b10-1d3a-4c2e-9e81-1b3e8a2d0001",
      "display_id": "UJETKAN",
      "name": "簡傑特",
      "avatar_url": null
    }
  ],
  "cap": 5,
  "points": 1840,
  "week_points": 280,
  "rank": 3,
  "role": "member",
  "requests": null,
  "created_at": "2026-03-15T08:00:00Z"
}
```

- [ ] **Step 3: Register both fixtures**

Edit `validate_examples.py`:

```python
from backend.contract.common import Paginated
from backend.contract.news import NewsItem
from backend.contract.rewards import Reward
from backend.contract.team import Team
from backend.contract.user import ProfileCreate, User

FIXTURES: dict[str, Any] = {
    "user.json": User,
    "profile_create.json": ProfileCreate,
    "rewards_list.json": TypeAdapter(list[Reward]),
    "news_list.json": TypeAdapter(Paginated[NewsItem]),
    "team_as_leader.json": Team,
    "team_as_member.json": Team,
}
```

- [ ] **Step 4: Run validator; expect ImportError**

Run:
```bash
just contract-validate
```

Expected: `ModuleNotFoundError: No module named 'backend.contract.team'`.

- [ ] **Step 5: Create `team.py`**

Write `backend/src/backend/contract/team.py`:
```python
"""Team shapes — the led/joined team views, the join-request workflow,
the partial-update body, and named response envelopes for the two /me
endpoints whose shape involves a Team."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.contract.common import UserRef
from backend.contract.user import User


class JoinRequest(BaseModel):
    """A pending/approved/rejected request to join a team. Visible to
    the team's leader and to the requester themselves."""
    model_config = ConfigDict(extra="forbid")

    id: UUID
    team_id: UUID
    user: UserRef
    status: Literal["pending", "approved", "rejected"]
    requested_at: datetime


class Team(BaseModel):
    """Full team view.

    `role` reflects the caller's relationship to the team (leader /
    member / None for outsiders). `requests` is populated only when the
    caller is the leader; members and outsiders see `None`.
    """
    model_config = ConfigDict(extra="forbid")

    id: UUID
    display_id: str = Field(pattern=r"^T-[A-Z0-9]{3,10}$")
    name: str
    alias: str | None = None
    topic: str
    leader: UserRef
    members: list[UserRef] = Field(default_factory=list)
    cap: int = 6
    points: int = 0
    week_points: int = 0
    rank: int | None = None
    role: Literal["leader", "member"] | None = None
    requests: list[JoinRequest] | None = None
    created_at: datetime


class TeamUpdate(BaseModel):
    """Request body for PATCH /teams/{id} (leader only). All fields
    optional for partial update."""
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    alias: str | None = None
    topic: str | None = None


class MeTeamsResponse(BaseModel):
    """Response body for GET /me/teams. Named envelope over an inline
    dict so Phase 4 TS codegen and Phase 5 FastAPI share one OpenAPI
    schema."""
    model_config = ConfigDict(extra="forbid")

    led: Team | None = None
    joined: Team | None = None


class MeProfileCreateResponse(BaseModel):
    """Response body for POST /me/profile. Returned atomically with the
    profile completion and led-team creation."""
    model_config = ConfigDict(extra="forbid")

    user: User
    led_team: Team
```

- [ ] **Step 6: Run validator; expect PASS**

Run:
```bash
just contract-validate
```

Expected:
```
OK       user.json
OK       profile_create.json
OK       rewards_list.json
OK       news_list.json
OK       team_as_leader.json
OK       team_as_member.json

6/6 fixtures valid.
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/backend/contract/team.py \
        backend/src/backend/contract/examples/team_as_leader.json \
        backend/src/backend/contract/examples/team_as_member.json \
        backend/src/backend/contract/validate_examples.py
git commit -m "$(cat <<'EOF'
contract: add Team, JoinRequest, TeamUpdate, me response envelopes

Full team response (caller-scoped `role` and `requests`), the
join-request lifecycle entity, the partial-update body for PATCH, and
two named response envelopes — MeTeamsResponse (GET /me/teams) and
MeProfileCreateResponse (POST /me/profile) — so Phase 4/5 consumers
share one OpenAPI schema instead of each inventing inline dicts.

Two fixtures exercise both caller perspectives (leader sees requests,
member sees null).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `rank.py` + fixtures

**Files:**
- Create: `backend/src/backend/contract/rank.py`
- Create: `backend/src/backend/contract/examples/rank_users_week.json`
- Create: `backend/src/backend/contract/examples/rank_teams_week.json`
- Modify: `backend/src/backend/contract/validate_examples.py`

- [ ] **Step 1: Write `examples/rank_users_week.json`**

Write `backend/src/backend/contract/examples/rank_users_week.json`:
```json
{
  "items": [
    {
      "user": {
        "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b0031",
        "display_id": "UYAZHU",
        "name": "吳雅萱",
        "avatar_url": null
      },
      "rank": 1,
      "points": 3240,
      "week_points": 480
    },
    {
      "user": {
        "id": "7f7a9b10-1d3a-4c2e-9e81-1b3e8a2d0001",
        "display_id": "UJETKAN",
        "name": "簡傑特",
        "avatar_url": null
      },
      "rank": 17,
      "points": 480,
      "week_points": 120
    }
  ],
  "next_cursor": "eyJvZmZzZXQiOjJ9"
}
```

- [ ] **Step 2: Write `examples/rank_teams_week.json`**

Write `backend/src/backend/contract/examples/rank_teams_week.json`:
```json
{
  "items": [
    {
      "team": {
        "id": "c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d0003",
        "display_id": "T-CHU1109",
        "name": "童心共讀",
        "topic": "兒童陪讀",
        "leader": {
          "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b0041",
          "display_id": "UCHU",
          "name": "劉雅筑",
          "avatar_url": null
        }
      },
      "rank": 1,
      "points": 2680,
      "week_points": 420
    }
  ],
  "next_cursor": null
}
```

- [ ] **Step 3: Register both fixtures**

Edit `validate_examples.py`:

```python
from backend.contract.common import Paginated
from backend.contract.news import NewsItem
from backend.contract.rank import TeamRankEntry, UserRankEntry
from backend.contract.rewards import Reward
from backend.contract.team import Team
from backend.contract.user import ProfileCreate, User

FIXTURES: dict[str, Any] = {
    "user.json": User,
    "profile_create.json": ProfileCreate,
    "rewards_list.json": TypeAdapter(list[Reward]),
    "news_list.json": TypeAdapter(Paginated[NewsItem]),
    "team_as_leader.json": Team,
    "team_as_member.json": Team,
    "rank_users_week.json": TypeAdapter(Paginated[UserRankEntry]),
    "rank_teams_week.json": TypeAdapter(Paginated[TeamRankEntry]),
}
```

- [ ] **Step 4: Run validator; expect ImportError**

Run:
```bash
just contract-validate
```

Expected: `ModuleNotFoundError: No module named 'backend.contract.rank'`.

- [ ] **Step 5: Create `rank.py`**

Write `backend/src/backend/contract/rank.py`:
```python
"""Leaderboard shapes — one per user, one per team, both filterable by
period ("week" / "month" / "all_time"). Wrapped in Paginated[T] at the
endpoint level."""
from typing import Literal

from pydantic import BaseModel, ConfigDict

from backend.contract.common import TeamRef, UserRef

RankPeriod = Literal["week", "month", "all_time"]


class UserRankEntry(BaseModel):
    """Single entry in the user leaderboard."""
    model_config = ConfigDict(extra="forbid")

    user: UserRef
    rank: int
    points: int
    week_points: int


class TeamRankEntry(BaseModel):
    """Single entry in the team leaderboard."""
    model_config = ConfigDict(extra="forbid")

    team: TeamRef
    rank: int
    points: int
    week_points: int
```

- [ ] **Step 6: Run validator; expect PASS**

Run:
```bash
just contract-validate
```

Expected (8 OK lines + `8/8 fixtures valid.`).

- [ ] **Step 7: Commit**

```bash
git add backend/src/backend/contract/rank.py \
        backend/src/backend/contract/examples/rank_users_week.json \
        backend/src/backend/contract/examples/rank_teams_week.json \
        backend/src/backend/contract/validate_examples.py
git commit -m "$(cat <<'EOF'
contract: add UserRankEntry, TeamRankEntry, RankPeriod

Leaderboard entries for the rank screen, served as Paginated[T].
Period filter is a closed Literal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `task.py` + fixtures

Adds the user-facing `Task` merged view, the discriminated submit bodies, and the submit response. Task 3 (team challenge) and task 4 (expired) have no form_type; only task 1 ("interest") and task 2 ("ticket") accept submissions.

**Files:**
- Create: `backend/src/backend/contract/task.py`
- Create: `backend/src/backend/contract/examples/task_interest.json`
- Create: `backend/src/backend/contract/examples/task_team_challenge.json`
- Create: `backend/src/backend/contract/examples/interest_form_submit.json`
- Create: `backend/src/backend/contract/examples/ticket_form_submit.json`
- Modify: `backend/src/backend/contract/validate_examples.py`

- [ ] **Step 1: Write `examples/task_interest.json`**

A completed task 1 view. `form_type == "interest"`, `progress == 1.0`, every step done.

Write `backend/src/backend/contract/examples/task_interest.json`:
```json
{
  "id": "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b0001",
  "display_id": "T1",
  "title": "填寫金富有志工表單",
  "summary": "完成你的志工個人資料，開啟金富有志工旅程。",
  "description": "歡迎加入金富有志工！請填寫基本個人資料，讓我們了解你的興趣、專長與可投入時段，並協助系統為你推薦合適的任務與團隊。",
  "tag": "探索",
  "color": "#fec701",
  "points": 50,
  "bonus": null,
  "due_at": null,
  "est_minutes": 5,
  "is_challenge": false,
  "requires": [],
  "cap": null,
  "form_type": "interest",
  "status": "completed",
  "progress": 1.0,
  "steps": [
    {
      "id": "e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f0001",
      "label": "確認電子郵件與手機",
      "done": true,
      "order": 1
    },
    {
      "id": "e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f0002",
      "label": "填寫個人興趣與專長",
      "done": true,
      "order": 2
    },
    {
      "id": "e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f0003",
      "label": "選擇可投入的時段",
      "done": true,
      "order": 3
    },
    {
      "id": "e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f0004",
      "label": "簽署志工服務同意書",
      "done": true,
      "order": 4
    }
  ],
  "team_progress": null,
  "created_at": "2026-04-01T00:00:00Z"
}
```

- [ ] **Step 2: Write `examples/task_team_challenge.json`**

Task 3, in progress, with team_progress populated.

Write `backend/src/backend/contract/examples/task_team_challenge.json`:
```json
{
  "id": "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b0003",
  "display_id": "T3",
  "title": "組隊挑戰",
  "summary": "組建至少 6 人志工團隊，一起挑戰進階任務。",
  "description": "招募夥伴加入你的團隊（你是隊長），或申請加入朋友的團隊。截止日前團隊成員數達 6 人即可獲得獎勵，人數不設上限。",
  "tag": "陪伴",
  "color": "#fed234",
  "points": 200,
  "bonus": "金鑰匙紀念筆",
  "due_at": "2026-04-30T23:59:59Z",
  "est_minutes": 30,
  "is_challenge": true,
  "requires": [
    "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b0001",
    "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b0002"
  ],
  "cap": 6,
  "form_type": null,
  "status": "in_progress",
  "progress": 0.33,
  "steps": [],
  "team_progress": {
    "total": 2,
    "cap": 6,
    "led_total": 2,
    "joined_total": 0
  },
  "created_at": "2026-04-01T00:00:00Z"
}
```

- [ ] **Step 3: Write `examples/interest_form_submit.json`**

Request body for `POST /tasks/{task_1_id}/submit`. Carries `form_type: "interest"`.

Write `backend/src/backend/contract/examples/interest_form_submit.json`:
```json
{
  "form_type": "interest",
  "name": "簡傑特",
  "phone": "912345678",
  "interests": ["活動策劃", "攝影紀錄"],
  "skills": ["設計美編", "資料分析"],
  "availability": ["週末白天", "週末晚上"]
}
```

- [ ] **Step 4: Write `examples/ticket_form_submit.json`**

Request body for `POST /tasks/{task_2_id}/submit`. Carries `form_type: "ticket"`.

Write `backend/src/backend/contract/examples/ticket_form_submit.json`:
```json
{
  "form_type": "ticket",
  "name": "簡傑特",
  "ticket_725": "RL-0725-8420",
  "ticket_726": "RL-0726-1173",
  "note": "素食"
}
```

- [ ] **Step 5: Register all four fixtures**

Edit `validate_examples.py`:

```python
from backend.contract.common import Paginated
from backend.contract.news import NewsItem
from backend.contract.rank import TeamRankEntry, UserRankEntry
from backend.contract.rewards import Reward
from backend.contract.task import InterestFormBody, Task, TicketFormBody
from backend.contract.team import Team
from backend.contract.user import ProfileCreate, User

FIXTURES: dict[str, Any] = {
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
}
```

- [ ] **Step 6: Run validator; expect ImportError**

Run:
```bash
just contract-validate
```

Expected: `ModuleNotFoundError: No module named 'backend.contract.task'`.

- [ ] **Step 7: Create `task.py`**

Write `backend/src/backend/contract/task.py`:
```python
"""Task shapes — the user-facing merged view (global definition + caller
state) plus the discriminated form-body union for submissions.

Derivation rules (server-authoritative; frontend must match):
  * `status == "locked"` iff any id in `requires` is not in the caller's
    set of completed task ids.
  * `status == "expired"` iff `due_at` is in the past and the caller has
    not completed the task.
  * `progress` is authoritative; clients display `steps[].done` for the
    checklist UX but never compute `progress` from it.
"""
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.contract.rewards import Reward


class TaskStep(BaseModel):
    """One step in a task's checklist. `done` reflects the caller's state."""
    model_config = ConfigDict(extra="forbid")

    id: UUID
    label: str
    done: bool
    order: int


class TeamChallengeProgress(BaseModel):
    """Aggregate progress for a team-challenge task.

    `total = max(led_total, joined_total)` — the higher of the caller's
    led-team or joined-team head count (server-computed).
    """
    model_config = ConfigDict(extra="forbid")

    total: int
    cap: int
    led_total: int
    joined_total: int


class Task(BaseModel):
    """User-facing task view. Server-side merge of the global task
    definition and the caller's per-user state."""
    model_config = ConfigDict(extra="forbid")

    id: UUID
    display_id: str
    title: str
    summary: str
    description: str
    tag: Literal["探索", "社区", "陪伴"]
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    points: int = Field(ge=0)
    bonus: str | None = None
    due_at: datetime | None = None
    est_minutes: int = Field(ge=0)
    is_challenge: bool = False
    requires: list[UUID] = Field(default_factory=list)
    cap: int | None = None
    form_type: Literal["interest", "ticket"] | None = None
    status: Literal["todo", "in_progress", "completed", "expired", "locked"]
    progress: float | None = Field(default=None, ge=0.0, le=1.0)
    steps: list[TaskStep] = Field(default_factory=list)
    team_progress: TeamChallengeProgress | None = None
    created_at: datetime


class InterestFormBody(BaseModel):
    """POST /tasks/{id}/submit body for tasks with form_type == 'interest'
    (task 1)."""
    model_config = ConfigDict(extra="forbid")

    form_type: Literal["interest"]
    name: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    interests: list[str] = Field(min_length=1)
    skills: list[str] = Field(default_factory=list)
    availability: list[str] = Field(min_length=1)


class TicketFormBody(BaseModel):
    """POST /tasks/{id}/submit body for tasks with form_type == 'ticket'
    (task 2)."""
    model_config = ConfigDict(extra="forbid")

    form_type: Literal["ticket"]
    name: str = Field(min_length=1)
    ticket_725: str = Field(min_length=1)
    ticket_726: str = Field(min_length=1)
    note: str | None = None


SubmitBody = Annotated[
    InterestFormBody | TicketFormBody,
    Field(discriminator="form_type"),
]
"""Discriminated union on `form_type` for the submit endpoint.

Backends should type the request body as this annotated union —
FastAPI/Pydantic emits a tagged `oneOf` into OpenAPI, and generated
TypeScript clients get a clean discriminated union.
"""


class TaskSubmissionResponse(BaseModel):
    """Response body for POST /tasks/{id}/submit.

    `reward` is null when the task has `bonus is None`.
    """
    model_config = ConfigDict(extra="forbid")

    task: Task
    reward: Reward | None = None
```

- [ ] **Step 8: Run validator; expect PASS**

Run:
```bash
just contract-validate
```

Expected: 12 OK lines + `12/12 fixtures valid.`

- [ ] **Step 9: Verify the discriminated union works programmatically**

Run:
```bash
(cd backend && uv run python -c "
from pydantic import TypeAdapter
from backend.contract.task import SubmitBody
adapter = TypeAdapter(SubmitBody)
interest = adapter.validate_python({'form_type':'interest','name':'X','phone':'1','interests':['a'],'availability':['b']})
ticket = adapter.validate_python({'form_type':'ticket','name':'X','ticket_725':'a','ticket_726':'b'})
print(type(interest).__name__, type(ticket).__name__)
")
```

Expected: `InterestFormBody TicketFormBody`. Confirms Pydantic dispatches correctly on `form_type`.

- [ ] **Step 10: Commit**

```bash
git add backend/src/backend/contract/task.py \
        backend/src/backend/contract/examples/task_interest.json \
        backend/src/backend/contract/examples/task_team_challenge.json \
        backend/src/backend/contract/examples/interest_form_submit.json \
        backend/src/backend/contract/examples/ticket_form_submit.json \
        backend/src/backend/contract/validate_examples.py
git commit -m "$(cat <<'EOF'
contract: add Task, form bodies, and submit response

User-facing Task view with server-authoritative status/progress rules,
TaskStep, TeamChallengeProgress (max of led/joined head counts), the
InterestFormBody and TicketFormBody with explicit form_type literals,
and the SubmitBody discriminated union used by POST /tasks/{id}/submit.

Fixtures cover a completed form task, an in-progress team challenge,
and both submit-body variants.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `auth.py` + fixtures

**Files:**
- Create: `backend/src/backend/contract/auth.py`
- Create: `backend/src/backend/contract/examples/auth_google_request.json`
- Create: `backend/src/backend/contract/examples/auth_google_response.json`
- Modify: `backend/src/backend/contract/validate_examples.py`

- [ ] **Step 1: Write `examples/auth_google_request.json`**

Write `backend/src/backend/contract/examples/auth_google_request.json`:
```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.eyJzdWIiOiIxMDAwMDAwMDAwMDAwIn0.sig"
}
```

- [ ] **Step 2: Write `examples/auth_google_response.json`**

A first-time sign-in response: user exists but `profile_complete` is `false`. `name` defaults to the email-local-part per the derivation rule.

Write `backend/src/backend/contract/examples/auth_google_response.json`:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZjdhOWIxMC0xZDNhLTRjMmUtOWU4MS0xYjNlOGEyZDAwMDEifQ.sig",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": "7f7a9b10-1d3a-4c2e-9e81-1b3e8a2d0001",
    "display_id": "UJETKAN",
    "email": "jet@example.com",
    "zh_name": null,
    "en_name": null,
    "nickname": null,
    "name": "jet",
    "phone": null,
    "phone_code": null,
    "line_id": null,
    "telegram_id": null,
    "country": null,
    "location": null,
    "avatar_url": null,
    "profile_complete": false,
    "created_at": "2026-04-19T09:00:00Z"
  },
  "profile_complete": false
}
```

- [ ] **Step 3: Register both fixtures**

Edit `validate_examples.py`:

```python
from backend.contract.auth import AuthResponse, GoogleAuthRequest
from backend.contract.common import Paginated
from backend.contract.news import NewsItem
from backend.contract.rank import TeamRankEntry, UserRankEntry
from backend.contract.rewards import Reward
from backend.contract.task import InterestFormBody, Task, TicketFormBody
from backend.contract.team import Team
from backend.contract.user import ProfileCreate, User

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
}
```

- [ ] **Step 4: Run validator; expect ImportError**

Run:
```bash
just contract-validate
```

Expected: `ModuleNotFoundError: No module named 'backend.contract.auth'`.

- [ ] **Step 5: Create `auth.py`**

Write `backend/src/backend/contract/auth.py`:
```python
"""Auth request/response shapes for the Google OAuth sign-in flow.

TokenClaims is intentionally NOT re-exported from backend.contract; it
describes the JWT payload the backend should encode for documentation
only, and is never used as a request or response body.
"""
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from backend.contract.user import User


class GoogleAuthRequest(BaseModel):
    """Request body for POST /auth/google."""
    model_config = ConfigDict(extra="forbid")

    id_token: str


class AuthResponse(BaseModel):
    """Response body for POST /auth/google.

    `profile_complete` mirrors `user.profile_complete` for convenience
    on the client so the first screen routing decision can be made
    without a second round-trip.
    """
    model_config = ConfigDict(extra="forbid")

    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: User
    profile_complete: bool


class TokenClaims(BaseModel):
    """JWT payload shape (documentation only).

    NOT a request/response body and NOT re-exported from
    backend.contract — this model exists so backend authors have a
    Pydantic description of what to encode in the access_token.
    """
    model_config = ConfigDict(extra="forbid")

    sub: UUID
    email: EmailStr
    exp: int
    iat: int
```

- [ ] **Step 6: Run validator; expect PASS**

Run:
```bash
just contract-validate
```

Expected: 14 OK lines + `14/14 fixtures valid.`

- [ ] **Step 7: Commit**

```bash
git add backend/src/backend/contract/auth.py \
        backend/src/backend/contract/examples/auth_google_request.json \
        backend/src/backend/contract/examples/auth_google_response.json \
        backend/src/backend/contract/validate_examples.py
git commit -m "$(cat <<'EOF'
contract: add GoogleAuthRequest, AuthResponse, TokenClaims

TokenClaims is documentation-only — describes the JWT payload the
backend should encode — and is intentionally not re-exported from the
package.

Fixtures cover first-time sign-in (profile_complete=false, name derived
from email-local-part).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `__init__.py` re-exports

With every domain module in place, wire the package public surface so consumers can `from backend.contract import User, Task, Team, ...`.

**Files:**
- Modify: `backend/src/backend/contract/__init__.py`

- [ ] **Step 1: Replace `__init__.py` with full re-exports**

Overwrite `backend/src/backend/contract/__init__.py`:
```python
"""Phase 2 API contract — Pydantic 2 models shared between the frontend
and the FastAPI backend. See `endpoints.md` for the endpoint catalog and
`README.md` for a consumer guide.

Usage::

    from backend.contract import User, Task, Team, AuthResponse, Paginated

`TokenClaims` is intentionally not re-exported — it describes the JWT
payload shape for documentation only and is not a request/response body.
"""
from backend.contract.auth import AuthResponse, GoogleAuthRequest
from backend.contract.common import Paginated, TeamRef, UserRef
from backend.contract.news import NewsItem
from backend.contract.rank import RankPeriod, TeamRankEntry, UserRankEntry
from backend.contract.rewards import Reward
from backend.contract.task import (
    InterestFormBody,
    SubmitBody,
    Task,
    TaskStep,
    TaskSubmissionResponse,
    TeamChallengeProgress,
    TicketFormBody,
)
from backend.contract.team import (
    JoinRequest,
    MeProfileCreateResponse,
    MeTeamsResponse,
    Team,
    TeamUpdate,
)
from backend.contract.user import ProfileCreate, ProfileUpdate, User

__all__ = [
    # auth
    "AuthResponse",
    "GoogleAuthRequest",
    # common
    "Paginated",
    "TeamRef",
    "UserRef",
    # news
    "NewsItem",
    # rank
    "RankPeriod",
    "TeamRankEntry",
    "UserRankEntry",
    # rewards
    "Reward",
    # task
    "InterestFormBody",
    "SubmitBody",
    "Task",
    "TaskStep",
    "TaskSubmissionResponse",
    "TeamChallengeProgress",
    "TicketFormBody",
    # team
    "JoinRequest",
    "MeProfileCreateResponse",
    "MeTeamsResponse",
    "Team",
    "TeamUpdate",
    # user
    "ProfileCreate",
    "ProfileUpdate",
    "User",
]
```

- [ ] **Step 2: Verify all public names import via the package root**

Run:
```bash
(cd backend && uv run python -c "
from backend.contract import (
    AuthResponse, GoogleAuthRequest,
    Paginated, TeamRef, UserRef,
    NewsItem,
    RankPeriod, TeamRankEntry, UserRankEntry,
    Reward,
    InterestFormBody, SubmitBody, Task, TaskStep,
    TaskSubmissionResponse, TeamChallengeProgress, TicketFormBody,
    JoinRequest, MeProfileCreateResponse, MeTeamsResponse, Team, TeamUpdate,
    ProfileCreate, ProfileUpdate, User,
)
print('all re-exports importable')
")
```

Expected: `all re-exports importable`.

- [ ] **Step 3: Verify `TokenClaims` is NOT re-exported**

Run:
```bash
(cd backend && uv run python -c "
import backend.contract as c
assert not hasattr(c, 'TokenClaims'), 'TokenClaims must not be re-exported'
from backend.contract.auth import TokenClaims
print('TokenClaims reachable via backend.contract.auth only — correct')
")
```

Expected: `TokenClaims reachable via backend.contract.auth only — correct`.

- [ ] **Step 4: Run validator once more to confirm nothing regressed**

Run:
```bash
just contract-validate
```

Expected: `14/14 fixtures valid.` Exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/contract/__init__.py
git commit -m "$(cat <<'EOF'
contract: wire __init__.py re-exports

Public surface: everything the frontend/backend are likely to import
directly. TokenClaims stays reachable via backend.contract.auth but is
deliberately omitted from the top-level re-exports (docs-only shape).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: `README.md` for the contract module

**Files:**
- Create: `backend/src/backend/contract/README.md`

- [ ] **Step 1: Write `README.md`**

Write `backend/src/backend/contract/README.md`:
````markdown
# `backend.contract`

The Phase 2 API contract: Pydantic 2 models describing the wire format
between the frontend and the FastAPI backend. See the full design at
[`../../../../docs/superpowers/specs/2026-04-19-api-contract-design.md`](../../../../docs/superpowers/specs/2026-04-19-api-contract-design.md)
and the endpoint catalog at [`endpoints.md`](endpoints.md).

## Consume

```python
from backend.contract import (
    # Shared
    Paginated, UserRef, TeamRef,
    # User
    User, ProfileCreate, ProfileUpdate,
    # Auth
    GoogleAuthRequest, AuthResponse,
    # Task
    Task, TaskStep, TeamChallengeProgress,
    InterestFormBody, TicketFormBody, SubmitBody,
    TaskSubmissionResponse,
    # Team
    Team, JoinRequest, TeamUpdate, MeTeamsResponse, MeProfileCreateResponse,
    # Rank
    UserRankEntry, TeamRankEntry, RankPeriod,
    # Rewards & News
    Reward, NewsItem,
)
```

`TokenClaims` (JWT payload shape) is intentionally **not** re-exported —
it describes what the backend should encode in the access token for
documentation purposes only. Import it from `backend.contract.auth` if
you need the schema.

## Modules

| File             | Contents                                                                         |
|------------------|----------------------------------------------------------------------------------|
| `auth.py`        | `GoogleAuthRequest`, `AuthResponse`, `TokenClaims`                               |
| `common.py`      | `UserRef`, `TeamRef`, `Paginated[T]`                                             |
| `news.py`        | `NewsItem`                                                                       |
| `rank.py`        | `UserRankEntry`, `TeamRankEntry`, `RankPeriod`                                   |
| `rewards.py`     | `Reward`                                                                         |
| `task.py`        | `Task`, `TaskStep`, `TeamChallengeProgress`, `InterestFormBody`, `TicketFormBody`, `SubmitBody`, `TaskSubmissionResponse` |
| `team.py`        | `Team`, `JoinRequest`, `TeamUpdate`, `MeTeamsResponse`, `MeProfileCreateResponse` |
| `user.py`        | `User`, `ProfileCreate`, `ProfileUpdate`                                         |
| `endpoints.md`   | Human-readable endpoint catalog                                                  |
| `examples/`      | One JSON fixture per endpoint, grouped by domain                                 |
| `validate_examples.py` | Smoke test: loads each fixture and validates against its Pydantic model    |

## Validate

From the repository root:

```
just contract-validate
```

Exits 0 on success; non-zero if any fixture fails to parse against its
declared model. Run this any time you add or change a model or fixture.

## Using `SubmitBody`

`POST /tasks/{task_id}/submit` takes a discriminated union on
`form_type`. Use `SubmitBody` as the request-body annotation in FastAPI:

```python
from fastapi import APIRouter
from backend.contract import SubmitBody, TaskSubmissionResponse

router = APIRouter()

@router.post("/tasks/{task_id}/submit")
async def submit_task(task_id: UUID, body: SubmitBody) -> TaskSubmissionResponse:
    match body.form_type:
        case "interest":
            ...  # body is InterestFormBody here
        case "ticket":
            ...  # body is TicketFormBody here
```

FastAPI emits a tagged `oneOf` into OpenAPI based on the discriminator,
and generated TypeScript clients get a clean discriminated union.
````

- [ ] **Step 2: Commit**

```bash
git add backend/src/backend/contract/README.md
git commit -m "$(cat <<'EOF'
contract: add README.md for the contract module

Consumer guide: imports, module map, validator usage, and the
SubmitBody discriminator pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: `endpoints.md` — endpoint catalog

**Files:**
- Create: `backend/src/backend/contract/endpoints.md`

- [ ] **Step 1: Write `endpoints.md`**

Write `backend/src/backend/contract/endpoints.md`:
````markdown
# Endpoint Catalog — API v1

Full design spec: [`../../../../docs/superpowers/specs/2026-04-19-api-contract-design.md`](../../../../docs/superpowers/specs/2026-04-19-api-contract-design.md).

All paths under `/api/v1/`. `Auth` column: `—` = public, `B` = requires
`Authorization: Bearer <access_token>`. Bodies and responses reference
model names re-exported from `backend.contract`.

## Auth

### `POST /auth/google`
- Auth: —
- Body: `GoogleAuthRequest`
- 200: `AuthResponse`
- 401: invalid/expired `id_token`

### `POST /auth/logout`
- Auth: B
- Body: none
- 204

## Me

### `GET /me`
- Auth: B
- 200: `User`

### `POST /me/profile`
- Auth: B (first-time profile completion)
- Body: `ProfileCreate`
- 200: `MeProfileCreateResponse`  — atomically creates profile + led team
- 409: profile already complete

### `PATCH /me`
- Auth: B
- Body: `ProfileUpdate`
- 200: `User`

### `GET /me/tasks`
- Auth: B
- 200: `list[Task]`

### `GET /me/teams`
- Auth: B
- 200: `MeTeamsResponse`  (`{led: Team | null, joined: Team | null}`; see spec §2.7: `led` is effectively non-null for profile-complete callers)

### `GET /me/rewards`
- Auth: B
- 200: `list[Reward]`

## Tasks

### `GET /tasks/{task_id}`
- Auth: B
- 200: `Task`
- 404

### `POST /tasks/{task_id}/submit`
- Auth: B
- Body: `SubmitBody` — discriminated union `InterestFormBody | TicketFormBody` on `form_type`
- 200: `TaskSubmissionResponse`
- 400: task has no form / body `form_type` does not match task's declared `form_type`
- 404
- 409: already completed (double-submit is **not** idempotent — returns 409)
- 412: prerequisites unmet

## Teams

### `GET /teams`
- Auth: B
- Query: `q`, `topic`, `leader_display_id`, `cursor`, `limit` (default 20, max 100)
- 200: `Paginated[TeamRef]`

### `GET /teams/{team_id}`
- Auth: B
- 200: `Team`
- 404
- `Team.requests` populated only when caller is the leader.

### `PATCH /teams/{team_id}`  (leader only)
- Auth: B
- Body: `TeamUpdate`
- 200: `Team`
- 403 not leader; 404

### `POST /teams/{team_id}/join-requests`
- Auth: B
- Body: none
- 201: `JoinRequest`
- 404
- 409 when any of: caller is already a member or leader of this team; caller already has a pending request to this team; caller is already a member (or has a pending request) of any other team. Leaders cannot submit a join-request to their own team (409).

### `DELETE /teams/{team_id}/join-requests/{req_id}`  (requester only)
- Auth: B
- 204
- 403 not requester; 404

### `POST /teams/{team_id}/join-requests/{req_id}/approve`  (leader only)
- Auth: B
- 200: `Team`  — requester moves from `requests` into `members`; task 3 recomputes
- 403 not leader; 404

### `POST /teams/{team_id}/join-requests/{req_id}/reject`  (leader only)
- Auth: B
- 204
- 403 not leader; 404

### `POST /teams/{team_id}/leave`  (member only)
- Auth: B
- 204
- 403 leader cannot leave own team; 404

## Rank

### `GET /rank/users`
- Auth: B
- Query: `period` (`RankPeriod`, default `"week"`), `cursor`, `limit` (default 50, max 100)
- 200: `Paginated[UserRankEntry]`

### `GET /rank/teams`
- Auth: B
- Query: `period`, `cursor`, `limit`
- 200: `Paginated[TeamRankEntry]`

## News

### `GET /news`
- Auth: B
- Query: `cursor`, `limit` (default 20, max 100)
- 200: `Paginated[NewsItem]`  — sorted `pinned DESC, published_at DESC`

## Notes

- **No `POST /teams`** — every user's led team is auto-created by `POST /me/profile`.
- **No `DELETE /teams/{team_id}`** — the frontend UI gates the leave button on `!isLeader` (see `frontend/app.jsx:6845`); leaders have no disband path.
- **Error shape** — FastAPI defaults. Business errors return `{"detail": "<message>"}`; Pydantic validation errors return the default structured list.
- **Content type** — `application/json` only. UTF-8.
- **Datetimes** — ISO 8601 with `Z` (UTC).
- **Pagination** — `next_cursor` is the cursor to pass to the next call; `null` means no more pages.

See the design spec for full auth flow, status-code conventions, and deferred items.
````

- [ ] **Step 2: Commit**

```bash
git add backend/src/backend/contract/endpoints.md
git commit -m "$(cat <<'EOF'
contract: add endpoints.md catalog

Human-readable catalog of all 19 endpoints: methods, paths, auth, body
and response types, and the per-endpoint error codes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

- [ ] **Step 1: Run the full validator**

```bash
just contract-validate
```

Expected:
```
OK       auth_google_request.json
OK       auth_google_response.json
OK       user.json
OK       profile_create.json
OK       rewards_list.json
OK       news_list.json
OK       team_as_leader.json
OK       team_as_member.json
OK       rank_users_week.json
OK       rank_teams_week.json
OK       task_interest.json
OK       task_team_challenge.json
OK       interest_form_submit.json
OK       ticket_form_submit.json

14/14 fixtures valid.
```

- [ ] **Step 2: Confirm the tree is clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 3: Skim the recent commit history**

```bash
git log --oneline -20
```

Expected: 13 new `contract:` commits on top of the previous docs commits.

Phase 2 is complete. The `backend.contract` package is ready to consume.
