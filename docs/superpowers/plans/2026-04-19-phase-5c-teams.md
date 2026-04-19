# Phase 5c — Teams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profile completion (atomic user+team creation), team read/update, and the full join-request workflow including leave.

**Prereqs:** phase-5b merged.

**Architecture:** Shares the scoping decisions from the Phase 5 suite — thin layered design inside `backend/` with `db/`, `auth/`, `services/`, `routers/`. SQLModel tables are the persistence shape; `backend.contract` stays untouched as the wire-format source of truth.

**Tech Stack:** Python 3.14, FastAPI, SQLModel (SQLAlchemy 2.0 async), psycopg3, Alembic, PyJWT, Pydantic Settings, uv, pytest + pytest-asyncio + httpx + testcontainers[postgresql], Postgres 17.

**Spec:** `docs/superpowers/specs/2026-04-19-phase-2-api-contract-design.md` + `backend/src/backend/contract/endpoints.md`.

**Exit criteria:** Full team-lifecycle endpoints live; `POST /me/profile` → `GET /me/teams` → `POST /teams/{id}/join-requests` → `approve` → `leave` sequence works.

---

## Scoping decisions locked before drafting

| Decision | Choice | Why |
|---|---|---|
| Cursor encoding | `base64url(json.dumps({"id": "<uuid>", "sort": "<iso-ts-or-int>"}))` | Opaque to clients, stable under inserts at head. |
| Field naming | snake_case end-to-end (DB, Pydantic, JSON) | Matches spec §6 and the existing contract. |
| Derived fields | Computed in service layer on read | `Team.role`, `Team.requests` all derive from caller identity. |

---

## File plan

Files created (C) or modified (M) by this plan. Paths are relative to repo root `/Users/Jet/Developer/golden-abundance-lite`.

### `backend/src/backend/` — new/modified modules

| Path | Action | Contents |
|---|---|---|
| `backend/src/backend/services/pagination.py` | C | `encode_cursor`, `decode_cursor`, `paginate_keyset()` helper, `SortCol`, `InvalidCursor` |
| `backend/src/backend/services/team.py` | C | Team queries, `display_id` gen, update, join-request workflow, leave, caller-scoped `role`/`requests` shaping, team-challenge progress recompute |
| `backend/src/backend/routers/me.py` | M | Add `POST /me/profile`, `PATCH /me`, `GET /me/teams` |
| `backend/src/backend/routers/teams.py` | C | `GET /teams`, `GET/PATCH /teams/{id}`, join-request endpoints, leave |
| `backend/src/backend/server.py` | M | Mount teams router; register `InvalidCursor` exception handler |

### `backend/tests/` — new tests

| Path | Action | Contents |
|---|---|---|
| `backend/tests/helpers.py` | C | `sign_in` / `sign_in_and_complete` helpers used across D–H tests |
| `backend/tests/test_team_service.py` | C | `create_led_team`, `row_to_contract_team`, `search_team_refs` unit coverage |
| `backend/tests/test_pagination.py` | C | Cursor encode/decode round-trip, malformed cursor, `InvalidCursor ⊂ ValueError` |
| `backend/tests/test_me_profile.py` | C | `POST /me/profile`, one-shot 409, `PATCH /me` partial update |
| `backend/tests/test_me_teams.py` | C | `GET /me/teams` (led/joined shaping) |
| `backend/tests/test_teams_read.py` | C | List, detail, caller-scoped requests, cursor walk, malformed cursor 400 |
| `backend/tests/test_teams_update.py` | C | Leader update, non-leader 403 |
| `backend/tests/test_team_join_service.py` | C | JoinConflict rules + approve/reject/leave happy path |
| `backend/tests/test_team_join_endpoints.py` | C | POST create + DELETE cancel endpoints |
| `backend/tests/test_team_approve_reject.py` | C | Approve/reject endpoints + challenge-reward positive branch |
| `backend/tests/test_team_leave.py` | C | Leader-can't-leave, member-can-leave |
| `backend/tests/test_team_auth.py` | C | Parametrized 401 smoke across all team endpoints |

---

## Section D — Profile completion + Teams read/update

**Exit criteria:** A freshly-signed-in user can `POST /me/profile` (creating their led team atomically), `PATCH /me` to edit fields, see their teams via `GET /me/teams`, browse teams via `GET /teams`, fetch a team via `GET /teams/{id}` (with caller-scoped `role`/`requests`), and (as leader) `PATCH /teams/{id}`.

### Task D1: Team service — create + map + search

**Files:**
- Create: `backend/src/backend/services/team.py`
- Create: `backend/tests/test_team_service.py`

- [ ] **Step 1: Write `tests/test_team_service.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import TeamMembershipRow, UserRow
from backend.services.team import (
    create_led_team,
    row_to_contract_team,
    search_team_refs,
)
from backend.services.user import upsert_user_by_email


async def test_create_led_team_sets_name_and_topic(session: AsyncSession) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    user.zh_name = "簡傑特"
    await session.flush()

    team = await create_led_team(session, user)
    await session.commit()

    assert team.display_id.startswith("T-")
    assert "簡傑特" in team.name
    assert team.topic == "尚未指定主題"
    assert team.leader_id == user.id


async def test_row_to_contract_team_as_leader_sees_requests(session: AsyncSession) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    team = await create_led_team(session, user)
    await session.commit()

    contract = await row_to_contract_team(session, team, caller_id=user.id)
    assert contract.role == "leader"
    assert contract.requests == []  # leader sees empty list, not None


async def test_row_to_contract_team_as_outsider_hides_requests(session: AsyncSession) -> None:
    leader = await upsert_user_by_email(session, email="leader@example.com")
    outsider = await upsert_user_by_email(session, email="out@example.com")
    await session.flush()
    team = await create_led_team(session, leader)
    await session.commit()

    contract = await row_to_contract_team(session, team, caller_id=outsider.id)
    assert contract.role is None
    assert contract.requests is None


async def test_row_to_contract_team_as_member(session: AsyncSession) -> None:
    leader = await upsert_user_by_email(session, email="leader@example.com")
    member = await upsert_user_by_email(session, email="mem@example.com")
    await session.flush()
    team = await create_led_team(session, leader)
    session.add(TeamMembershipRow(team_id=team.id, user_id=member.id))
    await session.commit()

    contract = await row_to_contract_team(session, team, caller_id=member.id)
    assert contract.role == "member"
    assert contract.requests is None
    assert any(m.id == member.id for m in contract.members)


async def test_search_team_refs_filters_by_leader_display_id(session: AsyncSession) -> None:
    jet = await upsert_user_by_email(session, email="jet@example.com")
    jet.zh_name = "簡傑特"
    wei = await upsert_user_by_email(session, email="wei@example.com")
    wei.zh_name = "偉"
    await session.flush()
    await create_led_team(session, jet)
    await create_led_team(session, wei)
    await session.commit()

    page = await search_team_refs(
        session, q=None, topic=None, leader_display_id=jet.display_id, cursor=None, limit=20
    )
    assert len(page.items) == 1
    assert page.items[0].leader.id == jet.id


async def test_user_to_ref_does_not_leak_pii(session: AsyncSession) -> None:
    """UserRef must not expose email/phone/line_id/etc. to other team members."""
    from backend.db.models import UserRow
    from backend.services.user import upsert_user_by_email
    from backend.services.team import user_to_ref

    user = await upsert_user_by_email(session, email="jet@example.com")
    user.phone = "0912345678"
    user.line_id = "private-line-id"
    user.zh_name = "簡傑特"
    await session.flush()

    ref = user_to_ref(user)
    dumped = ref.model_dump()
    assert set(dumped.keys()) == {"id", "display_id", "name", "avatar_url"}
    assert "email" not in dumped
    assert "phone" not in dumped
    assert "line_id" not in dumped
```

- [ ] **Step 2: Run — expect ImportError**

- [ ] **Step 3: Write `services/team.py`**

```python
"""Team service: creation, caller-scoped mapping, and search.

``create_led_team`` is called from the profile-completion flow in the
same transaction that flips ``profile_complete`` to True. The default
name is ``"{user_name}的團隊"``; the user can override via ``alias``
later. Initial topic is the literal ``"尚未指定主題"`` — matches the
frontend prototype's placeholder (see contract design §1.4).
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import JoinRequest as ContractJoinRequest
from backend.contract import Paginated
from backend.contract import Team as ContractTeam
from backend.contract import TeamRef as ContractTeamRef
from backend.contract import UserRef as ContractUserRef
from backend.db.models import (
    JoinRequestRow,
    TeamMembershipRow,
    TeamRow,
    UserRow,
)
from backend.services.display_id import generate_team_display_id
from backend.services.pagination import SortCol, paginate_keyset


def user_to_ref(row: UserRow) -> ContractUserRef:
    name = row.zh_name or row.nickname or row.email.split("@", 1)[0]
    return ContractUserRef(
        id=row.id, display_id=row.display_id, name=name, avatar_url=row.avatar_url
    )


async def create_led_team(session: AsyncSession, user: UserRow) -> TeamRow:
    result = await session.execute(select(TeamRow.display_id))
    taken = {row[0] for row in result.all()}
    display_id = generate_team_display_id(user_display_id=user.display_id, used=taken)
    leader_name = user.zh_name or user.nickname or user.email.split("@", 1)[0]
    team = TeamRow(
        display_id=display_id,
        name=f"{leader_name}的團隊",
        leader_id=user.id,
    )
    session.add(team)
    await session.flush()
    return team


async def row_to_contract_team(
    session: AsyncSession, team: TeamRow, *, caller_id: UUID
) -> ContractTeam:
    leader = await session.get(UserRow, team.leader_id)
    if leader is None:
        raise RuntimeError(
            f"Data integrity: team {team.id} references missing leader {team.leader_id}"
        )

    memberships = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.team_id == team.id)
        )
    ).scalars().all()
    member_user_ids = [m.user_id for m in memberships]
    members: list[ContractUserRef] = []
    if member_user_ids:
        member_rows = (
            await session.execute(
                select(UserRow).where(UserRow.id.in_(member_user_ids))
            )
        ).scalars().all()
        members = [user_to_ref(u) for u in member_rows]

    if caller_id == team.leader_id:
        role: str | None = "leader"
    elif caller_id in member_user_ids:
        role = "member"
    else:
        role = None

    requests: list[ContractJoinRequest] | None
    if role == "leader":
        join_rows = (
            await session.execute(
                select(JoinRequestRow)
                .where(JoinRequestRow.team_id == team.id)
                .where(JoinRequestRow.status == "pending")
                .order_by(JoinRequestRow.requested_at.asc())
            )
        ).scalars().all()
        requests = []
        for jr in join_rows:
            requester = await session.get(UserRow, jr.user_id)
            if requester is None:
                raise RuntimeError(
                    f"Data integrity: join_request {jr.id} references missing user {jr.user_id}"
                )
            requests.append(
                ContractJoinRequest(
                    id=jr.id,
                    team_id=jr.team_id,
                    user=user_to_ref(requester),
                    status=jr.status,
                    requested_at=jr.requested_at,
                )
            )
    else:
        requests = None

    return ContractTeam(
        id=team.id,
        display_id=team.display_id,
        name=team.name,
        alias=team.alias,
        topic=team.topic,
        leader=user_to_ref(leader),
        members=members,
        cap=team.cap,
        points=team.points,
        week_points=team.week_points,
        rank=None,
        role=role,  # type: ignore[arg-type]
        requests=requests,
        created_at=team.created_at,
    )


async def search_team_refs(
    session: AsyncSession,
    *,
    q: str | None,
    topic: str | None,
    leader_display_id: str | None,
    cursor: str | None,
    limit: int,
) -> Paginated[ContractTeamRef]:
    from datetime import datetime

    stmt = select(TeamRow, UserRow).join(UserRow, TeamRow.leader_id == UserRow.id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(TeamRow.name.ilike(like) | TeamRow.alias.ilike(like))
    if topic:
        stmt = stmt.where(TeamRow.topic == topic)
    if leader_display_id:
        stmt = stmt.where(UserRow.display_id == leader_display_id)

    page, next_cursor = await paginate_keyset(
        session,
        stmt,
        sort=[
            SortCol(
                TeamRow.created_at,
                to_json=lambda d: d.isoformat(),
                from_json=datetime.fromisoformat,
            ),
            SortCol(TeamRow.id, to_json=str, from_json=UUID),
        ],
        cursor=cursor,
        limit=limit,
        extract=lambda r: (r[0].created_at, r[0].id),
    )

    items = [
        ContractTeamRef(
            id=team.id,
            display_id=team.display_id,
            name=team.name,
            topic=team.topic,
            leader=user_to_ref(leader),
        )
        for team, leader in page
    ]
    return Paginated[ContractTeamRef](items=items, next_cursor=next_cursor)
```

Note this file imports `backend.services.pagination` — next step creates it.

- [ ] **Step 4: Write `services/pagination.py`**

```python
"""Keyset pagination helpers.

Cursor format is a URL-safe base64 of a JSON list — one entry per sort
column, in the order the caller declared. Clients treat it as opaque.

`paginate_keyset` is the actual paginator: it applies the ORDER BY, adds
the tuple-comparison WHERE that filters strictly past the cursor,
fetches one extra row to detect more pages, and builds the next cursor
from the last-returned row's sort-column values. The filter and encoder
share one `sort` spec, so the "decoded-but-unused sort key" bug class is
eliminated by construction.

Constraint: every sort column must have the same direction — Phase-5
paginators are all DESC. Mixed directions need an OR-expansion of the
cursor predicate which this helper doesn't implement.

Malformed cursors raise `InvalidCursor`; `backend.server.create_app()`
registers a global handler that turns those into HTTP 400.
"""

import base64
import json
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import ColumnElement, Row, Select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession


class InvalidCursor(ValueError):
    """Malformed or tampered cursor. The global exception handler in
    `backend.server.create_app()` translates this into HTTP 400."""


@dataclass(frozen=True)
class SortCol:
    """One column in a paginator's sort tuple.

    `to_json` / `from_json` convert between the DB value and its
    JSON-serializable form in the cursor payload. Defaults suit str
    (e.g. an already-serialized id); UUID / datetime columns must
    override — see the call sites in `services/team.py` and
    `services/news.py`.
    """

    col: ColumnElement[Any]
    to_json: Callable[[Any], Any] = str
    from_json: Callable[[Any], Any] = field(default=lambda v: v)


def encode_cursor(payload: Any) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(cursor: str) -> Any:
    pad = "=" * (-len(cursor) % 4)
    try:
        raw = base64.urlsafe_b64decode(cursor + pad)
        return json.loads(raw)
    except (ValueError, json.JSONDecodeError) as exc:
        raise InvalidCursor("Invalid cursor") from exc


async def paginate_keyset(
    session: AsyncSession,
    stmt: Select[Any],
    *,
    sort: Sequence[SortCol],
    cursor: str | None,
    limit: int,
    extract: Callable[[Row[Any]], Sequence[Any]],
) -> tuple[list[Row[Any]], str | None]:
    """Apply DESC-keyset pagination to ``stmt`` over ``sort``.

    ``extract`` pulls the sort-column values out of one fetched row in
    the same order as ``sort`` — e.g. ``lambda r: (r[0].created_at,
    r[0].id)`` for a two-entity ``select(A, B)`` statement.

    Returns ``(page_rows, next_cursor)``. ``next_cursor`` is None on the
    last page. Raises ``InvalidCursor`` on malformed input or
    cursor-shape mismatch.
    """
    if cursor is not None:
        payload = decode_cursor(cursor)
        if not isinstance(payload, list) or len(payload) != len(sort):
            raise InvalidCursor("cursor shape does not match sort columns")
        values = [s.from_json(payload[i]) for i, s in enumerate(sort)]
        stmt = stmt.where(
            tuple_(*(s.col for s in sort)) < tuple_(*values)
        )
    stmt = stmt.order_by(*(s.col.desc() for s in sort)).limit(limit + 1)

    rows = (await session.execute(stmt)).all()
    page = rows[:limit]
    next_cursor: str | None = None
    if len(rows) > limit and page:
        last_values = extract(page[-1])
        next_cursor = encode_cursor(
            [s.to_json(v) for s, v in zip(sort, last_values, strict=True)]
        )
    return page, next_cursor
```

- [ ] **Step 5: Write `tests/test_pagination.py`**

```python
import pytest

from backend.services.pagination import InvalidCursor, decode_cursor, encode_cursor


def test_cursor_round_trip_dict() -> None:
    payload = {"id": "7f7a9b10-1d3a-4c2e-9e81-1b3e8a2d0001", "sort": "2026-04-01T10:30:00Z"}
    assert decode_cursor(encode_cursor(payload)) == payload


def test_cursor_round_trip_list() -> None:
    # New shape: paginate_keyset encodes a positional list, one entry per SortCol.
    payload = ["2026-04-01T10:30:00+00:00", "7f7a9b10-1d3a-4c2e-9e81-1b3e8a2d0001"]
    assert decode_cursor(encode_cursor(payload)) == payload


def test_decode_rejects_garbage() -> None:
    with pytest.raises(InvalidCursor):
        decode_cursor("not-valid-base64-..-!!!")


def test_invalid_cursor_is_value_error_subclass() -> None:
    # Lets callers that only care about "malformed cursor" catch ValueError
    # without importing InvalidCursor.
    assert issubclass(InvalidCursor, ValueError)
```

- [ ] **Step 6: Run**

```bash
(cd backend && uv run pytest tests/test_pagination.py tests/test_team_service.py -v)
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/backend/services/team.py backend/src/backend/services/pagination.py backend/tests/test_team_service.py backend/tests/test_pagination.py
git commit -m "$(cat <<'EOF'
phase5: add team service (create/map/search) and cursor helpers

create_led_team: display_id generation + default name. row_to_contract_team:
caller-scoped role and requests (leader sees [], others see None).
search_team_refs: filterable paginated TeamRef list. Cursor encoding is
opaque base64(JSON).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task D2: Test helpers + POST /me/profile + PATCH /me

**Files:**
- Create: `backend/tests/helpers.py`
- Modify: `backend/src/backend/routers/me.py`
- Create: `backend/tests/test_me_profile.py`

- [ ] **Step 1: Write `backend/tests/helpers.py`**

All subsequent test modules (D2–E4, F, G, H) import sign-in helpers from here. Returning a single `SignedInUser` tuple avoids the "which helper returns which subset" divergence that would otherwise spread across files.

```python
"""Shared test helpers.

Keep small. Anything reusable across 3+ test modules lives here.
"""

from typing import NamedTuple
from uuid import UUID

from httpx import AsyncClient

_BASE_PROFILE = {
    "zh_name": "X",
    "phone": "1",
    "phone_code": "+886",
    "country": "台灣",
    "location": "台北",
}


class SignedInUser(NamedTuple):
    """Result of `sign_in_and_complete` — the three IDs downstream tests need."""

    headers: dict[str, str]
    user_id: UUID
    led_team_id: UUID


async def sign_in(client: AsyncClient, email: str) -> dict[str, str]:
    """Sign in via the stub. Returns bearer-auth headers."""
    r = await client.post("/api/v1/auth/google", json={"id_token": email})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def sign_in_and_complete(
    client: AsyncClient, email: str, zh_name: str = "X"
) -> SignedInUser:
    """Sign in + complete profile (auto-creates led team). Returns
    headers, user_id, and the auto-created led_team_id."""
    headers = await sign_in(client, email)
    body = {**_BASE_PROFILE, "zh_name": zh_name}
    response = await client.post("/api/v1/me/profile", json=body, headers=headers)
    payload = response.json()
    return SignedInUser(
        headers=headers,
        user_id=UUID(payload["user"]["id"]),
        led_team_id=UUID(payload["led_team"]["id"]),
    )
```

- [ ] **Step 2: Write `tests/test_me_profile.py`**

```python
from httpx import AsyncClient

from tests.helpers import sign_in

_PROFILE_BODY = {
    "zh_name": "簡傑特",
    "en_name": "Jet Kan",
    "nickname": "Jet",
    "phone": "912345678",
    "phone_code": "+886",
    "line_id": "jetkan",
    "telegram_id": None,
    "country": "台灣",
    "location": "台北",
}


async def test_post_profile_sets_flag_and_creates_led_team(client: AsyncClient) -> None:
    headers = await sign_in(client, "jet@example.com")
    response = await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["profile_complete"] is True
    assert data["user"]["zh_name"] == "簡傑特"
    assert data["led_team"]["leader"]["id"] == data["user"]["id"]
    assert data["led_team"]["display_id"].startswith("T-")


async def test_post_profile_is_one_shot(client: AsyncClient) -> None:
    headers = await sign_in(client, "jet@example.com")
    await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    second = await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    assert second.status_code == 409


async def test_patch_me_partial_update(client: AsyncClient) -> None:
    headers = await sign_in(client, "jet@example.com")
    await client.post("/api/v1/me/profile", json=_PROFILE_BODY, headers=headers)
    response = await client.patch(
        "/api/v1/me", json={"nickname": "JetNew"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["nickname"] == "JetNew"
    assert response.json()["zh_name"] == "簡傑特"  # untouched
```

- [ ] **Step 3: Replace `routers/me.py` contents**

```python
"""Me endpoints: GET /me, POST /me/profile, PATCH /me.

POST /me/profile is idempotent only in the failing sense: a completed
profile returns 409. This matches spec §1.2 (one-shot completion).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.contract import (
    MeProfileCreateResponse,
    ProfileCreate,
    ProfileUpdate,
    User as ContractUser,
)
from backend.db.models import UserRow
from backend.db.session import get_session
from backend.services.team import create_led_team, row_to_contract_team
from backend.services.user import row_to_contract_user

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=ContractUser)
async def get_me(me: UserRow = Depends(current_user)) -> ContractUser:
    return row_to_contract_user(me)


@router.post("/profile", response_model=MeProfileCreateResponse)
async def complete_profile(
    body: ProfileCreate,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MeProfileCreateResponse:
    if me.profile_complete:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Profile already complete."
        )
    # Atomic: all profile fields + flag + led team, single commit.
    me.zh_name = body.zh_name
    me.en_name = body.en_name
    me.nickname = body.nickname
    me.phone = body.phone
    me.phone_code = body.phone_code
    me.line_id = body.line_id
    me.telegram_id = body.telegram_id
    me.country = body.country
    me.location = body.location
    me.profile_complete = True
    session.add(me)
    await session.flush()

    team = await create_led_team(session, me)
    await session.commit()
    await session.refresh(me)
    await session.refresh(team)

    return MeProfileCreateResponse(
        user=row_to_contract_user(me),
        led_team=await row_to_contract_team(session, team, caller_id=me.id),
    )


@router.patch("", response_model=ContractUser)
async def patch_me(
    body: ProfileUpdate,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ContractUser:
    for field_name, value in body.model_dump(exclude_unset=True).items():
        setattr(me, field_name, value)
    session.add(me)
    await session.commit()
    await session.refresh(me)
    return row_to_contract_user(me)
```

- [ ] **Step 4: Run tests**

```bash
(cd backend && uv run pytest tests/test_me_profile.py -v)
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/helpers.py backend/src/backend/routers/me.py backend/tests/test_me_profile.py
git commit -m "$(cat <<'EOF'
phase5: add POST /me/profile and PATCH /me; introduce tests/helpers.py

POST atomically flips profile_complete=True and creates the led team
(single commit). Re-posting returns 409. PATCH does partial updates
using model_dump(exclude_unset=True) so None values don't wipe fields.
helpers.py exposes sign_in / sign_in_and_complete used across D-H.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task D3: GET /me/teams

**Files:**
- Modify: `backend/src/backend/routers/me.py` (append handler)
- Create: `backend/tests/test_me_teams.py`

- [ ] **Step 1: Write `tests/test_me_teams.py`**

```python
from httpx import AsyncClient

from tests.helpers import sign_in, sign_in_and_complete


async def test_get_me_teams_led_only_when_fresh(client: AsyncClient) -> None:
    signed_in = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get("/api/v1/me/teams", headers=signed_in.headers)
    assert response.status_code == 200
    data = response.json()
    assert data["led"] is not None
    assert data["joined"] is None
    assert data["led"]["role"] == "leader"


async def test_get_me_teams_both_null_before_profile(client: AsyncClient) -> None:
    headers = await sign_in(client, "noprof@example.com")
    response = await client.get("/api/v1/me/teams", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["led"] is None
    assert data["joined"] is None
```

- [ ] **Step 2: Append to `routers/me.py`**

Hoist the `from sqlalchemy import select` and `from backend.db.models import TeamMembershipRow, TeamRow` lines to the module's top-level imports (add to the existing `from backend.db.models import UserRow` line), then append the handler:

```python
from backend.contract import MeTeamsResponse  # add to imports


@router.get("/teams", response_model=MeTeamsResponse)
async def get_me_teams(
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MeTeamsResponse:
    led_row = (
        await session.execute(select(TeamRow).where(TeamRow.leader_id == me.id))
    ).scalar_one_or_none()
    joined_row = None
    joined_link = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.user_id == me.id)
        )
    ).scalar_one_or_none()
    if joined_link is not None:
        joined_row = await session.get(TeamRow, joined_link.team_id)

    return MeTeamsResponse(
        led=await row_to_contract_team(session, led_row, caller_id=me.id) if led_row else None,
        joined=(
            await row_to_contract_team(session, joined_row, caller_id=me.id)
            if joined_row
            else None
        ),
    )
```

- [ ] **Step 3: Run tests**

```bash
(cd backend && uv run pytest tests/test_me_teams.py -v)
```

Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/src/backend/routers/me.py backend/tests/test_me_teams.py
git commit -m "$(cat <<'EOF'
phase5: add GET /me/teams

Returns {led, joined} with caller-scoped role. Both null for users
who haven't completed profile yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task D4: GET /teams + GET /teams/{id}

**Files:**
- Create: `backend/src/backend/routers/teams.py`
- Modify: `backend/src/backend/server.py` (mount)
- Create: `backend/tests/test_teams_read.py`

- [ ] **Step 1: Write `tests/test_teams_read.py`**

```python
from httpx import AsyncClient

from tests.helpers import sign_in_and_complete


async def test_list_teams_returns_all(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    await sign_in_and_complete(client, "wei@example.com", "偉")

    response = await client.get("/api/v1/teams", headers=jet.headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2


async def test_list_teams_filters_by_leader_display_id(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    me_response = await client.get("/api/v1/me", headers=jet.headers)
    jet_display_id = me_response.json()["display_id"]
    await sign_in_and_complete(client, "wei@example.com", "偉")

    response = await client.get(
        "/api/v1/teams",
        params={"leader_display_id": jet_display_id},
        headers=jet.headers,
    )
    assert len(response.json()["items"]) == 1


async def test_team_detail_leader_sees_empty_requests_list(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")

    response = await client.get(f"/api/v1/teams/{jet.led_team_id}", headers=jet.headers)
    assert response.status_code == 200
    assert response.json()["role"] == "leader"
    assert response.json()["requests"] == []


async def test_team_detail_outsider_sees_null_requests(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")

    response = await client.get(f"/api/v1/teams/{jet.led_team_id}", headers=out.headers)
    assert response.status_code == 200
    assert response.json()["role"] is None
    assert response.json()["requests"] is None


async def test_team_detail_404(client: AsyncClient) -> None:
    from uuid import uuid4
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get(f"/api/v1/teams/{uuid4()}", headers=jet.headers)
    assert response.status_code == 404


async def test_team_detail_member_sees_null_requests(client: AsyncClient) -> None:
    """Non-leader members must see `requests = null`, not the pending-request list."""
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")

    req = (await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )).json()
    await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/approve",
        headers=jet.headers,
    )
    response = await client.get(
        f"/api/v1/teams/{jet.led_team_id}", headers=out.headers
    )
    data = response.json()
    assert data["role"] == "member"
    assert data["requests"] is None


async def test_list_teams_cursor_walks_to_end(client: AsyncClient) -> None:
    # Three led teams (auto-created by sign_in_and_complete). Pagination
    # size=1 walks all three across three calls and reports next_cursor=None
    # on the last. Exercises the (created_at, id) keyset filter — if the
    # WHERE only considered id (ignoring created_at), this would drop or
    # duplicate rows because UUIDs are random.
    h1 = (await sign_in_and_complete(client, "a@example.com", "A")).headers
    await sign_in_and_complete(client, "b@example.com", "B")
    await sign_in_and_complete(client, "c@example.com", "C")

    seen_ids: list[str] = []
    cursor: str | None = None
    for _ in range(4):  # 3 pages + guard against infinite loop
        url = "/api/v1/teams?limit=1"
        if cursor:
            url += f"&cursor={cursor}"
        response = await client.get(url, headers=h1)
        assert response.status_code == 200
        data = response.json()
        seen_ids.extend(item["id"] for item in data["items"])
        cursor = data["next_cursor"]
        if cursor is None:
            break
    assert cursor is None
    assert len(seen_ids) == 3
    assert len(set(seen_ids)) == 3  # no dups across pages


async def test_list_teams_malformed_cursor_400(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.get(
        "/api/v1/teams?cursor=not-a-real-cursor!!!", headers=jet.headers
    )
    assert response.status_code == 400
```

- [ ] **Step 2: Write `routers/teams.py`**

```python
"""Team read endpoints (list + detail). Mutations live below in
separate handlers (D5 patch + E1-E3 join-request workflow)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.contract import Paginated, Team as ContractTeam, TeamRef
from backend.db.models import TeamRow, UserRow
from backend.db.session import get_session
from backend.services.team import row_to_contract_team, search_team_refs

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("", response_model=Paginated[TeamRef])
async def list_teams(
    q: str | None = None,
    topic: str | None = None,
    leader_display_id: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    _: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Paginated[TeamRef]:
    return await search_team_refs(
        session,
        q=q,
        topic=topic,
        leader_display_id=leader_display_id,
        cursor=cursor,
        limit=limit,
    )


@router.get("/{team_id}", response_model=ContractTeam)
async def get_team(
    team_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ContractTeam:
    team = await session.get(TeamRow, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return await row_to_contract_team(session, team, caller_id=me.id)
```

- [ ] **Step 3: Mount in `server.py` and register the malformed-cursor handler**

Add the teams router mount, plus a global exception handler that turns
`InvalidCursor` into a clean 400. This is the first paginated router to
ship; handler lives in `create_app()` so every later paginated endpoint
(rank, news) inherits it for free.

```python
from fastapi import Request
from fastapi.responses import JSONResponse

from backend.routers import auth, health, me, teams
from backend.services.pagination import InvalidCursor

# in create_app():
app.include_router(teams.router, prefix=API_V1)

async def _invalid_cursor_handler(_: Request, exc: InvalidCursor) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc) or "Invalid cursor"})

app.add_exception_handler(InvalidCursor, _invalid_cursor_handler)
```

- [ ] **Step 4: Run tests**

```bash
(cd backend && uv run pytest tests/test_teams_read.py -v)
```

Expected: 7 passed (the five read cases plus the cursor walk and the member-sees-null-requests case).

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/routers/teams.py backend/src/backend/server.py backend/tests/test_teams_read.py
git commit -m "$(cat <<'EOF'
phase5: add GET /teams and GET /teams/{id}

List with q/topic/leader_display_id/cursor filters, 100-row max enforced
by Pydantic Query. Detail shapes requests per caller (leader → [],
others → null).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task D5: PATCH /teams/{id} (leader only)

**Files:**
- Modify: `backend/src/backend/routers/teams.py` (append)
- Create: `backend/tests/test_teams_update.py`

- [ ] **Step 1: Write `tests/test_teams_update.py`**

```python
from httpx import AsyncClient

from tests.helpers import sign_in_and_complete


async def test_leader_can_update_topic_and_alias(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")

    original = (await client.get(f"/api/v1/teams/{jet.led_team_id}", headers=jet.headers)).json()
    original_name = original["name"]

    response = await client.patch(
        f"/api/v1/teams/{jet.led_team_id}",
        json={"topic": "長者陪伴", "alias": "金富有小隊"},
        headers=jet.headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["topic"] == "長者陪伴"
    assert data["alias"] == "金富有小隊"
    assert data["name"] == original_name, "PATCH with only topic/alias must not wipe name"


async def test_non_leader_cannot_update(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    response = await client.patch(
        f"/api/v1/teams/{jet.led_team_id}", json={"topic": "hack"}, headers=out.headers
    )
    assert response.status_code == 403


async def test_patch_team_rejects_unknown_field(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.patch(
        f"/api/v1/teams/{jet.led_team_id}",
        json={"foo": "bar"},
        headers=jet.headers,
    )
    assert r.status_code == 422
```

- [ ] **Step 2: Append to `routers/teams.py`**

```python
from backend.contract import TeamUpdate  # add to imports

# ... append ...


@router.patch("/{team_id}", response_model=ContractTeam)
async def update_team(
    team_id: UUID,
    body: TeamUpdate,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ContractTeam:
    team = await session.get(TeamRow, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if team.leader_id != me.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only the team leader can update it"
        )
    for field_name, value in body.model_dump(exclude_unset=True).items():
        setattr(team, field_name, value)
    session.add(team)
    await session.commit()
    await session.refresh(team)
    return await row_to_contract_team(session, team, caller_id=me.id)
```

- [ ] **Step 3: Run tests**

```bash
(cd backend && uv run pytest tests/test_teams_update.py -v)
```

Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/src/backend/routers/teams.py backend/tests/test_teams_update.py
git commit -m "$(cat <<'EOF'
phase5: add PATCH /teams/{id} (leader only)

Partial update of name/alias/topic; 403 for non-leaders, 404 for
unknown ids. exclude_unset so a null topic in the body doesn't wipe
existing data.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Section E — Team join-request workflow + leave

**Exit criteria:** Users can request to join a team; leaders approve (requester moves to `members`) or reject; members can leave; leaders cannot leave their own team. All business rules from spec §2.4 enforced, including the at-most-one-joined invariant.

### Task E1: Join-request helpers in `services/team.py`

**Files:**
- Modify: `backend/src/backend/services/team.py` (append helpers)
- Create: `backend/tests/test_team_join_service.py`

- [ ] **Step 1: Write `tests/test_team_join_service.py`**

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import TeamMembershipRow
from backend.services.team import (
    JoinConflict,
    approve_join_request,
    create_join_request,
    create_led_team,
    leave_team,
    reject_join_request,
)
from backend.services.user import upsert_user_by_email


async def _make_leader_and_outsider(session: AsyncSession):
    leader = await upsert_user_by_email(session, email="leader@example.com")
    outsider = await upsert_user_by_email(session, email="out@example.com")
    await session.flush()
    team = await create_led_team(session, leader)
    await session.commit()
    return leader, outsider, team


async def test_create_join_request_happy_path(session: AsyncSession) -> None:
    _, outsider, team = await _make_leader_and_outsider(session)
    req = await create_join_request(session, team=team, requester=outsider)
    await session.commit()
    assert req.status == "pending"
    assert req.team_id == team.id
    assert req.user_id == outsider.id


async def test_create_join_request_rejects_self_leader(session: AsyncSession) -> None:
    leader, _, team = await _make_leader_and_outsider(session)
    with pytest.raises(JoinConflict):
        await create_join_request(session, team=team, requester=leader)


async def test_create_join_request_rejects_duplicate_pending(session: AsyncSession) -> None:
    _, outsider, team = await _make_leader_and_outsider(session)
    await create_join_request(session, team=team, requester=outsider)
    await session.commit()
    with pytest.raises(JoinConflict):
        await create_join_request(session, team=team, requester=outsider)


async def test_create_join_request_rejects_if_already_joined_elsewhere(
    session: AsyncSession,
) -> None:
    _, outsider, team = await _make_leader_and_outsider(session)
    other_leader = await upsert_user_by_email(session, email="other@example.com")
    await session.flush()
    other_team = await create_led_team(session, other_leader)
    session.add(TeamMembershipRow(team_id=other_team.id, user_id=outsider.id))
    await session.commit()
    with pytest.raises(JoinConflict):
        await create_join_request(session, team=team, requester=outsider)


async def test_approve_moves_requester_to_members(session: AsyncSession) -> None:
    from sqlalchemy import select

    _, outsider, team = await _make_leader_and_outsider(session)
    req = await create_join_request(session, team=team, requester=outsider)
    await session.commit()
    await approve_join_request(session, team=team, req=req)
    await session.commit()
    assert req.status == "approved"
    links = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.team_id == team.id)
        )
    ).scalars().all()
    assert any(link.user_id == outsider.id for link in links)


async def test_reject_marks_status_but_not_member(session: AsyncSession) -> None:
    _, outsider, team = await _make_leader_and_outsider(session)
    req = await create_join_request(session, team=team, requester=outsider)
    await session.commit()
    await reject_join_request(session, req=req)
    await session.commit()
    assert req.status == "rejected"
    from sqlalchemy import select
    links = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.team_id == team.id)
        )
    ).scalars().all()
    assert links == []


async def test_leave_removes_membership(session: AsyncSession) -> None:
    _, outsider, team = await _make_leader_and_outsider(session)
    session.add(TeamMembershipRow(team_id=team.id, user_id=outsider.id))
    await session.commit()
    await leave_team(session, team=team, user=outsider)
    await session.commit()
    from sqlalchemy import select
    links = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.user_id == outsider.id)
        )
    ).scalars().all()
    assert links == []
```

- [ ] **Step 2: Run — expect ImportError on `JoinConflict`**

- [ ] **Step 3: Append helpers to `services/team.py`**

```python
# Append near the bottom. Also extend the module-level
# `from backend.db.models import (...)` block at the top of the file to
# include `RewardRow` and `TaskDefRow` — maybe_grant_challenge_rewards
# below needs them.


class JoinConflict(Exception):
    """Business-rule violation during join-request creation."""


async def create_join_request(
    session: AsyncSession, *, team: TeamRow, requester: UserRow
) -> JoinRequestRow:
    if team.leader_id == requester.id:
        raise JoinConflict("Leaders cannot request to join their own team")

    # Already a member of THIS team?
    existing_membership = (
        await session.execute(
            select(TeamMembershipRow).where(
                TeamMembershipRow.team_id == team.id,
                TeamMembershipRow.user_id == requester.id,
            )
        )
    ).scalar_one_or_none()
    if existing_membership is not None:
        raise JoinConflict("Already a member of this team")

    # Any existing team membership at all?
    any_membership = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.user_id == requester.id)
        )
    ).scalar_one_or_none()
    if any_membership is not None:
        raise JoinConflict("Already a member of a different team")

    # Any existing pending request?
    any_pending = (
        await session.execute(
            select(JoinRequestRow)
            .where(JoinRequestRow.user_id == requester.id)
            .where(JoinRequestRow.status == "pending")
        )
    ).scalar_one_or_none()
    if any_pending is not None:
        raise JoinConflict("Already has a pending join request")

    req = JoinRequestRow(team_id=team.id, user_id=requester.id, status="pending")
    session.add(req)
    await session.flush()
    return req


async def approve_join_request(
    session: AsyncSession, *, team: TeamRow, req: JoinRequestRow
) -> None:
    req.status = "approved"
    session.add(req)
    session.add(TeamMembershipRow(team_id=team.id, user_id=req.user_id))
    await session.flush()

    # Team just grew — reward any user on this team whose challenge-task
    # cap is now met. Safe no-op today (T3.bonus is None in the seed), but
    # prevents a silent reward loss if a future challenge ships with a
    # non-null bonus. Every leader + member's team size went up by 1.
    member_ids = [team.leader_id, req.user_id] + [
        row.user_id
        for row in (
            await session.execute(
                select(TeamMembershipRow).where(TeamMembershipRow.team_id == team.id)
            )
        ).scalars().all()
    ]
    # dedupe while preserving order
    seen: set = set()
    unique_member_ids = [uid for uid in member_ids if not (uid in seen or seen.add(uid))]
    for uid in unique_member_ids:
        user_row = await session.get(UserRow, uid)
        if user_row is not None:
            await maybe_grant_challenge_rewards(session, user=user_row)


async def reject_join_request(session: AsyncSession, *, req: JoinRequestRow) -> None:
    req.status = "rejected"
    session.add(req)
    await session.flush()


async def leave_team(session: AsyncSession, *, team: TeamRow, user: UserRow) -> None:
    link = (
        await session.execute(
            select(TeamMembershipRow).where(
                TeamMembershipRow.team_id == team.id,
                TeamMembershipRow.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if link is not None:
        await session.delete(link)
        await session.flush()


async def maybe_grant_challenge_rewards(
    session: AsyncSession, *, user: UserRow
) -> None:
    """Create RewardRows for any bonused challenge TaskDef where the user
    now meets cap and no reward row already exists. Idempotent. No-op
    when the user has no team (total == 0) or no bonused challenges exist.
    """
    challenge_defs = (
        await session.execute(
            select(TaskDefRow)
            .where(TaskDefRow.is_challenge.is_(True))
            .where(TaskDefRow.bonus.is_not(None))
        )
    ).scalars().all()
    if not challenge_defs:
        return

    # Compute user's current team totals (leader + members of led team,
    # leader + members of joined team; take max).
    led_team = (
        await session.execute(select(TeamRow).where(TeamRow.leader_id == user.id))
    ).scalar_one_or_none()
    led_total = 0
    if led_team is not None:
        led_mems = (
            await session.execute(
                select(TeamMembershipRow).where(TeamMembershipRow.team_id == led_team.id)
            )
        ).scalars().all()
        led_total = 1 + len(led_mems)
    joined_link = (
        await session.execute(
            select(TeamMembershipRow).where(TeamMembershipRow.user_id == user.id)
        )
    ).scalar_one_or_none()
    joined_total = 0
    if joined_link is not None:
        joined_mems = (
            await session.execute(
                select(TeamMembershipRow).where(
                    TeamMembershipRow.team_id == joined_link.team_id
                )
            )
        ).scalars().all()
        joined_total = 1 + len(joined_mems)
    total = max(led_total, joined_total)

    for td in challenge_defs:
        assert td.cap is not None  # enforced by row_to_contract_task; re-verify here
        if total < td.cap:
            continue
        existing = (
            await session.execute(
                select(RewardRow)
                .where(RewardRow.user_id == user.id)
                .where(RewardRow.task_def_id == td.id)
            )
        ).scalar_one_or_none()
        if existing is not None:
            continue
        assert td.bonus is not None  # filtered by the query above
        session.add(
            RewardRow(
                user_id=user.id,
                task_def_id=td.id,
                task_title=td.title,
                bonus=td.bonus,
                status="earned",
            )
        )
    await session.flush()
```

- [ ] **Step 4: Run tests**

```bash
(cd backend && uv run pytest tests/test_team_join_service.py -v)
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/services/team.py backend/tests/test_team_join_service.py
git commit -m "$(cat <<'EOF'
phase5: add join-request, approve/reject, leave service helpers

JoinConflict raised for all 409 rules (self-leader, duplicate, already
a member of any team, already has a pending request). approve_join_request
adds a TeamMembershipRow in the same transaction. leave_team is a no-op
when the user isn't actually a member.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task E2: POST /teams/{id}/join-requests + DELETE cancel

**Files:**
- Modify: `backend/src/backend/routers/teams.py` (append)
- Create: `backend/tests/test_team_join_endpoints.py`

- [ ] **Step 1: Write `tests/test_team_join_endpoints.py`**

```python
from httpx import AsyncClient

from tests.helpers import sign_in_and_complete


async def test_create_join_request_201(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")

    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["team_id"] == str(jet.led_team_id)


async def test_create_join_request_leader_to_own_team_409(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=jet.headers
    )
    assert response.status_code == 409


async def test_create_join_request_duplicate_pending_409(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    await client.post(f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers)
    second = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )
    assert second.status_code == 409


async def test_create_join_request_404_for_unknown_team(client: AsyncClient) -> None:
    from uuid import uuid4
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    response = await client.post(
        f"/api/v1/teams/{uuid4()}/join-requests",
        headers=out.headers,
    )
    assert response.status_code == 404


async def test_cancel_join_request_by_requester(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    created = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )
    req_id = created.json()["id"]

    response = await client.delete(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req_id}", headers=out.headers
    )
    assert response.status_code == 204


async def test_cancel_join_request_403_for_non_requester(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    third = await sign_in_and_complete(client, "third@example.com", "第三人")
    created = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )
    req_id = created.json()["id"]

    response = await client.delete(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req_id}", headers=third.headers
    )
    assert response.status_code == 403


async def test_create_join_request_rejects_if_pending_elsewhere(
    client: AsyncClient,
) -> None:
    """The at-most-one-outstanding-request-per-user invariant spans all teams."""
    leader_a = await sign_in_and_complete(client, "a@example.com", "A")
    leader_b = await sign_in_and_complete(client, "b@example.com", "B")
    out = await sign_in_and_complete(client, "out@example.com", "O")

    r1 = await client.post(
        f"/api/v1/teams/{leader_a.led_team_id}/join-requests",
        headers=out.headers,
    )
    assert r1.status_code == 201

    r2 = await client.post(
        f"/api/v1/teams/{leader_b.led_team_id}/join-requests",
        headers=out.headers,
    )
    assert r2.status_code == 409


async def test_requester_can_reapply_after_rejection(client: AsyncClient) -> None:
    """Rejected requests don't lock out re-applications (status != 'pending' path)."""
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")

    r1 = (await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )).json()
    await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{r1['id']}/reject",
        headers=jet.headers,
    )
    r2 = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )
    assert r2.status_code == 201


async def test_requester_can_rejoin_after_leave(client: AsyncClient) -> None:
    """After leaving a team, a user may re-request to join it."""
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")

    r = (await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )).json()
    await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{r['id']}/approve",
        headers=jet.headers,
    )
    await client.post(
        f"/api/v1/teams/{jet.led_team_id}/leave", headers=out.headers
    )
    r2 = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
    )
    assert r2.status_code == 201
```

- [ ] **Step 2: Append to `routers/teams.py`**

```python
# Add to imports:
from backend.contract import JoinRequest as ContractJoinRequest
from backend.db.models import JoinRequestRow
from backend.services.team import (
    JoinConflict,
    create_join_request,
    user_to_ref,
)
# (approve/reject/leave imported in later tasks.)


@router.post(
    "/{team_id}/join-requests",
    response_model=ContractJoinRequest,
    status_code=status.HTTP_201_CREATED,
)
async def request_to_join(
    team_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ContractJoinRequest:
    team = await session.get(TeamRow, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    try:
        req = await create_join_request(session, team=team, requester=me)
    except JoinConflict as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    await session.commit()
    await session.refresh(req)
    return ContractJoinRequest(
        id=req.id,
        team_id=req.team_id,
        user=user_to_ref(me),
        status=req.status,
        requested_at=req.requested_at,
    )


@router.delete(
    "/{team_id}/join-requests/{req_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def cancel_join_request(
    team_id: UUID,
    req_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    req = await session.get(JoinRequestRow, req_id)
    if req is None or req.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.user_id != me.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the requester can cancel a join request",
        )
    await session.delete(req)
    await session.commit()
```

- [ ] **Step 3: Run tests**

```bash
(cd backend && uv run pytest tests/test_team_join_endpoints.py -v)
```

Expected: 9 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/src/backend/routers/teams.py backend/src/backend/services/team.py backend/tests/test_team_join_endpoints.py
git commit -m "$(cat <<'EOF'
phase5: add POST /teams/{id}/join-requests and DELETE cancel

Create returns 201 with the JoinRequest shape; all 409 rules enforced
via JoinConflict. Cancel is requester-only (403 otherwise), 404 if the
request doesn't belong to that team.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task E3: POST approve / POST reject (leader only)

**Files:**
- Modify: `backend/src/backend/routers/teams.py` (append)
- Create: `backend/tests/test_team_approve_reject.py`

- [ ] **Step 1: Write `tests/test_team_approve_reject.py`**

```python
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import TaskDefRow
from tests.helpers import sign_in_and_complete


async def test_approve_adds_member(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    req = (
        await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
        )
    ).json()

    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/approve",
        headers=jet.headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert any(m["id"] == req["user"]["id"] for m in data["members"])


async def test_team_can_grow_past_cap(client: AsyncClient) -> None:
    """Spec §2.4: teams can grow past cap. Pin current behavior so a future
    cap-enforcement change is a conscious, tested decision."""
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    # Leader + 6 approved members = 7 > cap (default 6).
    for i in range(6):
        out = await sign_in_and_complete(client, f"m{i}@example.com", f"M{i}")
        req = (await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
        )).json()
        r = await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/approve",
            headers=jet.headers,
        )
        assert r.status_code == 200, f"approve #{i} failed: {r.text}"

    detail = (await client.get(
        f"/api/v1/teams/{jet.led_team_id}", headers=jet.headers
    )).json()
    # 6 members in `members` (leader excluded from the members list).
    assert len(detail["members"]) == 6


async def test_approve_non_leader_403(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    req = (
        await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
        )
    ).json()
    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/approve",
        headers=out.headers,
    )
    assert response.status_code == 403


async def test_reject_204(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    req = (
        await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
        )
    ).json()
    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/reject",
        headers=jet.headers,
    )
    assert response.status_code == 204


async def test_approve_grants_challenge_reward_at_cap(
    client: AsyncClient, session: AsyncSession
) -> None:
    """Positive branch of maybe_grant_challenge_rewards.

    Seeds a bonused challenge TaskDef with cap=2 (no seeded_task_defs
    fixture — we don't want unbonused T3 in the query). After the leader
    approves one outsider, the team reaches cap and both members should
    have a RewardRow. Without this test, the entire "reward the team"
    branch in services/team.py is dead code in Phase 5 (T3.bonus is
    None in the default seed).
    """
    session.add(
        TaskDefRow(
            display_id="TX",
            title="小隊挑戰",
            summary="trivial challenge",
            description="",
            tag="陪伴",
            color="#abcdef",
            points=100,
            bonus="挑戰紀念章",
            est_minutes=0,
            is_challenge=True,
            cap=2,
            form_type=None,
        )
    )
    await session.commit()

    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    req = (
        await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
        )
    ).json()
    approve = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/approve",
        headers=jet.headers,
    )
    assert approve.status_code == 200

    # Query rewards directly via the DB — GET /me/rewards lands in Phase 5d.
    from sqlalchemy import select
    from backend.db.models import RewardRow

    jet_rewards = (
        await session.execute(select(RewardRow).where(RewardRow.user_id == jet.user_id))
    ).scalars().all()
    out_rewards = (
        await session.execute(select(RewardRow).where(RewardRow.user_id == out.user_id))
    ).scalars().all()
    assert any(r.bonus == "挑戰紀念章" for r in jet_rewards), jet_rewards
    assert any(r.bonus == "挑戰紀念章" for r in out_rewards), out_rewards


async def test_leader_cannot_approve_request_from_different_team(
    client: AsyncClient,
) -> None:
    """Confused-deputy guard: leader A must not approve a request targeting team B
    by routing it through A's team path.

    This catches the case where `approve_join_request` forgets to verify
    `req.team_id == team_id` and becomes a cross-team privilege escalation.
    """
    leader_a = await sign_in_and_complete(client, "a@example.com", "A")
    leader_b = await sign_in_and_complete(client, "b@example.com", "B")
    out = await sign_in_and_complete(client, "out@example.com", "O")

    req = (
        await client.post(
            f"/api/v1/teams/{leader_b.led_team_id}/join-requests",
            headers=out.headers,
        )
    ).json()

    response = await client.post(
        f"/api/v1/teams/{leader_a.led_team_id}/join-requests/{req['id']}/approve",
        headers=leader_a.headers,
    )
    assert response.status_code == 404


async def test_approve_unknown_team_404(client: AsyncClient) -> None:
    from uuid import uuid4
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    unknown_team = uuid4()
    unknown_req = uuid4()
    r = await client.post(
        f"/api/v1/teams/{unknown_team}/join-requests/{unknown_req}/approve",
        headers=jet.headers,
    )
    assert r.status_code == 404


async def test_approve_unknown_req_404(client: AsyncClient) -> None:
    from uuid import uuid4
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{uuid4()}/approve",
        headers=jet.headers,
    )
    assert r.status_code == 404


async def test_reject_unknown_req_404(client: AsyncClient) -> None:
    from uuid import uuid4
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{uuid4()}/reject",
        headers=jet.headers,
    )
    assert r.status_code == 404


async def test_cancel_unknown_req_404(client: AsyncClient) -> None:
    """DELETE /join-requests/{unknown} → 404."""
    from uuid import uuid4
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.delete(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{uuid4()}",
        headers=jet.headers,
    )
    assert r.status_code == 404
```

- [ ] **Step 2: Append to `routers/teams.py`**

```python
from backend.services.team import approve_join_request, reject_join_request


@router.post(
    "/{team_id}/join-requests/{req_id}/approve", response_model=ContractTeam
)
async def approve_request(
    team_id: UUID,
    req_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ContractTeam:
    team = await session.get(TeamRow, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if team.leader_id != me.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only the leader can approve"
        )
    req = await session.get(JoinRequestRow, req_id)
    if req is None or req.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    await approve_join_request(session, team=team, req=req)
    await session.commit()
    await session.refresh(team)
    return await row_to_contract_team(session, team, caller_id=me.id)


@router.post(
    "/{team_id}/join-requests/{req_id}/reject",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reject_request(
    team_id: UUID,
    req_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    team = await session.get(TeamRow, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if team.leader_id != me.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only the leader can reject"
        )
    req = await session.get(JoinRequestRow, req_id)
    if req is None or req.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    await reject_join_request(session, req=req)
    await session.commit()
```

- [ ] **Step 3: Run tests**

```bash
(cd backend && uv run pytest tests/test_team_approve_reject.py -v)
```

Expected: 10 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/src/backend/routers/teams.py backend/tests/test_team_approve_reject.py
git commit -m "$(cat <<'EOF'
phase5: add POST approve/reject for join requests (leader only)

Approve returns the updated Team (requester visible in .members);
reject is a 204. Both 403 for non-leaders, 404 when request doesn't
belong to the path team. test_approve_grants_challenge_reward_at_cap
seeds a bonused challenge def with cap=2 and asserts both leader and
new member receive a RewardRow when approve tips the team to cap —
exercises the positive branch of maybe_grant_challenge_rewards that
the default T3 seed (bonus=None) never reaches.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task E4: POST /teams/{id}/leave

**Files:**
- Modify: `backend/src/backend/routers/teams.py` (append)
- Create: `backend/tests/test_team_leave.py`

- [ ] **Step 1: Write `tests/test_team_leave.py`**

```python
from httpx import AsyncClient

from tests.helpers import sign_in_and_complete


async def test_leader_cannot_leave_own_team(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/leave", headers=jet.headers
    )
    assert response.status_code == 403


async def test_member_can_leave(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    out = await sign_in_and_complete(client, "out@example.com", "外人")
    req = (
        await client.post(
            f"/api/v1/teams/{jet.led_team_id}/join-requests", headers=out.headers
        )
    ).json()
    await client.post(
        f"/api/v1/teams/{jet.led_team_id}/join-requests/{req['id']}/approve",
        headers=jet.headers,
    )

    response = await client.post(
        f"/api/v1/teams/{jet.led_team_id}/leave", headers=out.headers
    )
    assert response.status_code == 204

    # Caller's joined team is now null
    me_teams = await client.get("/api/v1/me/teams", headers=out.headers)
    assert me_teams.json()["joined"] is None
```

- [ ] **Step 2: Append to `routers/teams.py`**

```python
from backend.services.team import leave_team


@router.post("/{team_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave(
    team_id: UUID,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    team = await session.get(TeamRow, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if team.leader_id == me.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Leaders cannot leave their own team"
        )
    await leave_team(session, team=team, user=me)
    await session.commit()
```

- [ ] **Step 3: Run tests**

```bash
(cd backend && uv run pytest tests/test_team_leave.py -v)
```

Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/src/backend/routers/teams.py backend/tests/test_team_leave.py
git commit -m "$(cat <<'EOF'
phase5: add POST /teams/{id}/leave

Idempotent for members; 403 if caller is the team's leader (per spec
§2.4 — no disband path exists either). 204 on success.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task E5: 401-smoke across team endpoints

**Files:**
- Create: `backend/tests/test_team_auth.py`

Defence-in-depth: every team endpoint is wired to `Depends(current_user)`,
but a single missing dependency is silent until a caller triggers it. A
parametrized smoke test over every route eliminates that blind spot.

- [ ] **Step 1: Write `tests/test_team_auth.py`**

```python
import pytest
from uuid import uuid4

from httpx import AsyncClient


@pytest.mark.parametrize(
    "method,path",
    [
        ("POST", "/api/v1/me/profile"),
        ("PATCH", "/api/v1/me"),
        ("GET", "/api/v1/me/teams"),
        ("GET", "/api/v1/teams"),
        ("GET", f"/api/v1/teams/{uuid4()}"),
        ("PATCH", f"/api/v1/teams/{uuid4()}"),
        ("POST", f"/api/v1/teams/{uuid4()}/join-requests"),
        ("POST", f"/api/v1/teams/{uuid4()}/join-requests/{uuid4()}/approve"),
        ("POST", f"/api/v1/teams/{uuid4()}/join-requests/{uuid4()}/reject"),
        ("DELETE", f"/api/v1/teams/{uuid4()}/join-requests/{uuid4()}"),
        ("POST", f"/api/v1/teams/{uuid4()}/leave"),
    ],
)
async def test_endpoint_requires_auth(client: AsyncClient, method: str, path: str) -> None:
    r = await client.request(method, path)
    assert r.status_code == 401, f"{method} {path} should require auth"
```

- [ ] **Step 2: Run tests**

```bash
(cd backend && uv run pytest tests/test_team_auth.py -v)
```

Expected: 11 passed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_team_auth.py
git commit -m "$(cat <<'EOF'
phase5: add parametrized 401-smoke across team endpoints

Guards against a silent regression where a router forgets
Depends(current_user) and quietly becomes anonymous. Covers every
endpoint added in phase 5c.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist

**Spec coverage — endpoints shipped by this plan:**

| Endpoint | Task |
|---|---|
| `POST /me/profile` | D2 |
| `PATCH /me` | D2 |
| `GET /me/teams` | D3 |
| `GET /teams` | D4 |
| `GET /teams/{team_id}` | D4 |
| `PATCH /teams/{team_id}` | D5 |
| `POST /teams/{team_id}/join-requests` | E2 |
| `DELETE /teams/{team_id}/join-requests/{req_id}` | E2 |
| `POST /teams/{team_id}/join-requests/{req_id}/approve` | E3 |
| `POST /teams/{team_id}/join-requests/{req_id}/reject` | E3 |
| `POST /teams/{team_id}/leave` | E4 |

**Placeholder scan:** No `TBD` / `implement later` / "similar to task N" / "add error handling" / "write tests for the above" placeholders remain. Every code step ships complete, runnable code.

**Type consistency:**
- `user_to_ref` is defined in `services/team.py` (Task D1) and imported by routers (Task E2) without renaming.
- `current_user` FastAPI dependency returns `UserRow` everywhere.
- Mapping-helper keyword convention: `row_to_contract_team(session, team, *, caller_id: UUID)` (D1) accepts an ID — the team mapper only needs the ID.
- `JoinConflict` is the single exception raised from the team service for the 409 cluster; routers translate it to `HTTPException(409)` uniformly (Task E2).

**Known gaps surfaced during plan writing (documented, not blocking):**

- `Team.points` / `Team.week_points` / `Team.rank` are exposed in the `Team` response but Phase 5 always writes 0 / 0 / null — live values come from the leaderboard computation in `rank.py` (in Phase 5d). If a team detail screen needs live totals, thread `leaderboard_teams` totals through `row_to_contract_team`. Not in scope for this plan.
- **N+1 query load in `row_to_contract_team`.** Each call iterates members and join-requests with separate `session.get(UserRow, ...)` lookups. Fine for teams ≤ 10 members; if `GET /teams/{id}` ever becomes hot, batch the member/requester user loads with one `select(UserRow).where(UserRow.id.in_(...))`. Not measured; flagged here so no one re-discovers it.
- **`test_approve_grants_challenge_reward_at_cap` asserts on `RewardRow` directly, not via `GET /me/rewards`.** The endpoint lands in Phase 5d; the test is phase-appropriate because reward-row creation is 5c's responsibility, and a direct DB read isolates the 5c behaviour without a cross-phase dependency.
- **Phase 5c intentionally does not enforce `cap` on team size.** Per spec §2.4, "teams can grow past cap" — `cap` bounds the *challenge-reward trigger*, not team membership. A test that approves past `cap` is fine and should succeed.
- **`client` fixture shares a single session across test + all its requests** (inherited from 5a conftest). Combined with `expire_on_commit=False`, an in-memory row attached to the test's session can hold stale field values after an API call mutates the underlying row through the same session. Tests that post an API call and then read a field must issue a fresh query (e.g. via `select(...)` or `session.refresh(row)`) rather than rely on the pre-call Python object.
- **`create_join_request` is non-atomic.** The 4 conflict checks (self-leader, member-of-this-team, member-of-any-team, pending-request) are separate SELECTs before the INSERT. Two concurrent requests by the same user could both pass the checks and both INSERT, violating the at-most-one-pending invariant. Acceptable for single-tenant Phase-5 dev. To tighten in Phase 6: add a partial unique index `WHERE status='pending'` on `join_requests(user_id)` and catch `IntegrityError` for a clean 409 retranslate, or wrap the precheck-then-insert in a `SELECT … FOR UPDATE` row lock on the requester's UserRow.
- **Reward-cascade N+1 in `approve_join_request`.** After approval, the function loops over all members (leader + new + existing) and calls `maybe_grant_challenge_rewards` per user, which itself runs 3-4 SELECTs (challenge defs, led team, led mems, joined link, joined mems, existing reward). For a 6-member team that's roughly 24 queries on a single approval. Acceptable for Phase-5 single-tenant scale; if approval becomes hot, batch the per-user reward check into one query that joins members + challenge defs + existing rewards, or move the cascade to a background job.

**Resolved during review (previously flagged as gaps):**

- ✅ **Keyset pagination is a shared helper, not inline.** `services/pagination.py` exposes `paginate_keyset(session, stmt, *, sort, cursor, limit, extract)` plus a `SortCol` dataclass; `search_team_refs` calls through it. The filter and the encoder share one `sort` spec, so the "decoded-but-unused sort key" bug class (team search originally used only `id < cursor.id` despite sorting by `created_at, id`) is eliminated by construction.
- ✅ **Malformed cursor is a clean 400.** `decode_cursor` raises `InvalidCursor` (a `ValueError` subclass); `create_app()` registers one global handler that translates it to HTTP 400 so `?cursor=garbage` no longer surfaces as 500 on any paginated endpoint. Covered by `test_list_teams_malformed_cursor_400`.
- ✅ **Team search cursor is exercised end-to-end.** `test_list_teams_cursor_walks_to_end` walks three led teams at `limit=1` and asserts no-duplicates / no-drops / terminal `next_cursor=None` — would have caught the original id-only filter bug.
- ✅ **Challenge-reward positive branch is tested.** `test_approve_grants_challenge_reward_at_cap` in Task E3 seeds a bonused challenge with cap=2 and asserts both leader and new member get RewardRows when approval tips the team to cap — the function's reward-creation loop (dead under the default seed where `T3.bonus is None`) is now covered.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-19-phase-5c-teams.md`.**

The plan lives in the main repo so it's visible across worktrees. Before executing, create a worktree under `.worktree/phase-5c-teams` (per user's global instruction) so Phase-5c work stays isolated.

Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task with a two-stage review between them. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks sequentially in the current session with batch checkpoints. Use `superpowers:executing-plans`. Faster wall-clock, but the main session's context fills up quickly.

**After 5c merges, proceed to phase-5d-content.**

**Which approach would you like?**
