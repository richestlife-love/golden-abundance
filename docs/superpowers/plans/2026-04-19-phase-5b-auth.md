# Phase 5b — Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google-stub auth, HS256 JWT issuance, and the `current_user` dep; expose POST /auth/google, POST /auth/logout, and GET /me.

**Prereqs:** phase-5a merged.

**Architecture:** Shares the scoping decisions from the Phase 5 suite — thin layered design inside `backend/` with `db/`, `auth/`, `services/`, `routers/`. SQLModel tables are the persistence shape; `backend.contract` stays untouched as the wire-format source of truth.

**Tech Stack:** Python 3.14, FastAPI, SQLModel (SQLAlchemy 2.0 async), psycopg3, Alembic, PyJWT, Pydantic Settings, uv, pytest + pytest-asyncio + httpx + testcontainers[postgresql], Postgres 17.

**Spec:** `docs/superpowers/specs/2026-04-19-phase-2-api-contract-design.md` + `backend/src/backend/contract/endpoints.md`.

**Exit criteria:** Caller can sign in via `POST /api/v1/auth/google` with `{"id_token": "user@example.com"}` and fetch `GET /api/v1/me` with the returned bearer.

---

## Scoping decisions locked before drafting

| Decision | Choice | Why |
|---|---|---|
| Auth stub | `id_token` is treated as the authenticated email string | Lets us test upsert-by-email exactly as Phase 6 will; no JWT parsing needed for the stub. |
| JWT library | `PyJWT>=2.10`, HS256, 24h TTL, secret from `JWT_SECRET` env | Standard choice. HS256 is fine for single-service; RS256 is not needed here. |
| Field naming | snake_case end-to-end (DB, Pydantic, JSON) | Matches spec §6 and the existing contract. |
| Derived fields | Computed in service layer on read | `User.name` derives from `zh_name` → `nickname` → email-local-part. |

**Scope Note:** Phase 5 explicitly defers real Google ID-token verification to Phase 6 (see spec §3). The `POST /auth/google` handler in this phase accepts any non-empty `id_token` and treats the token string as the authenticated email, then upserts the user and mints a real JWT.

---

## File plan

Files created (C) or modified (M) by this plan. Paths are relative to repo root `/Users/Jet/Developer/golden-abundance-lite`.

### `backend/src/backend/` — new modules

| Path | Action | Contents |
|---|---|---|
| `backend/src/backend/auth/__init__.py` | C | Re-exports |
| `backend/src/backend/auth/jwt.py` | C | `encode_token`, `decode_token` (PyJWT HS256) |
| `backend/src/backend/auth/google_stub.py` | C | `verify_id_token(raw: str) -> str` — returns email; Phase-5 stub treats input as email |
| `backend/src/backend/auth/dependencies.py` | C | `current_user` FastAPI dep |
| `backend/src/backend/services/__init__.py` | C | Re-exports |
| `backend/src/backend/services/display_id.py` | C | User/team `display_id` generation (deterministic + collision suffix) |
| `backend/src/backend/services/user.py` | C | Upsert-by-email, derive `name`, map row→`User` |
| `backend/src/backend/routers/auth.py` | C | `POST /auth/google`, `POST /auth/logout` |
| `backend/src/backend/routers/me.py` | C | `GET /me` (profile create/patch lands in 5c) |
| `backend/src/backend/server.py` | M | Mount auth + me routers under `/api/v1` |

### `backend/tests/` — new tests

| Path | Action | Contents |
|---|---|---|
| `backend/tests/test_jwt.py` | C | Encode/decode round-trip + expiry |
| `backend/tests/test_google_stub.py` | C | Stub email-echo + empty-token + bad-shape rejection |
| `backend/tests/test_display_id.py` | C | User / team display_id generators + collision suffix |
| `backend/tests/test_user_service.py` | C | Upsert idempotence + `row_to_contract_user` name derivation |
| `backend/tests/test_auth.py` | C | `/auth/google` stub, `/auth/logout`, 401 on bad Bearer |
| `backend/tests/test_me.py` | C | `GET /me` returns the authenticated user |

---

## Section C — Auth (stubbed Google + real JWT)

**Exit criteria:** `POST /auth/google` accepts any string that parses as an email via email-validator (Phase 5 stub); invalid emails → 401. Upserts a user and returns a valid bearer token. `POST /auth/logout` returns 204. `GET /me` returns the authenticated caller's contract `User`.

### Task C1: JWT encode/decode

**Files:**
- Create: `backend/src/backend/auth/__init__.py`
- Create: `backend/src/backend/auth/jwt.py`
- Create: `backend/tests/test_jwt.py`

- [ ] **Step 1: Write `auth/__init__.py`**

```python
"""Authentication helpers: HS256 JWT + stub Google ID-token verifier.

Real Google JWKS verification lands in Phase 6; in Phase 5 the stub
treats the raw id_token as the authenticated email address.
"""
```

- [ ] **Step 2: Write the failing test `tests/test_jwt.py`**

```python
from datetime import timedelta
from uuid import uuid4

import pytest

from backend.auth.jwt import decode_token, encode_token


def test_encode_then_decode_round_trip() -> None:
    user_id = uuid4()
    email = "jet@example.com"
    token = encode_token(user_id=user_id, email=email)
    claims = decode_token(token)
    assert claims["sub"] == str(user_id)
    assert claims["email"] == email
    assert claims["iat"] < claims["exp"]


def test_decode_rejects_tampered_token() -> None:
    token = encode_token(user_id=uuid4(), email="x@example.com")
    # Flip the last character of the signature segment.
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
    with pytest.raises(ValueError):
        decode_token(tampered)


def test_decode_rejects_token_signed_with_different_secret() -> None:
    """HS256 signature verification: attacker-signed token must be rejected."""
    import jwt as pyjwt
    forged = pyjwt.encode(
        {"sub": str(uuid4()), "email": "e@example.com", "iat": 0, "exp": 9_999_999_999},
        "attacker-secret-not-ours",
        algorithm="HS256",
    )
    with pytest.raises(ValueError):
        decode_token(forged)


def test_decode_rejects_alg_none() -> None:
    """Historical PyJWT vulnerability — `alg: none` must never be accepted."""
    import jwt as pyjwt
    none_alg = pyjwt.encode(
        {"sub": str(uuid4()), "email": "e@example.com", "exp": 9_999_999_999},
        key="",
        algorithm="none",
    )
    with pytest.raises(ValueError):
        decode_token(none_alg)


def test_decode_requires_sub_claim() -> None:
    """Missing sub should not decode to a usable user."""
    import jwt as pyjwt
    from backend.config import get_settings
    token = pyjwt.encode(
        {"email": "e@example.com", "exp": 9_999_999_999},
        get_settings().jwt_secret,
        algorithm="HS256",
    )
    # Either decode raises, or downstream sub access raises — both acceptable.
    try:
        claims = decode_token(token)
        assert "sub" not in claims or not claims["sub"]
    except ValueError:
        pass


def test_decode_rejects_expired_token() -> None:
    token = encode_token(
        user_id=uuid4(), email="x@example.com", ttl=timedelta(seconds=-10)
    )
    with pytest.raises(ValueError):
        decode_token(token)
```

- [ ] **Step 3: Run — expect ImportError (module not yet created)**

```bash
(cd backend && uv run pytest tests/test_jwt.py -v)
```

Expected: collection error or ImportError on `backend.auth.jwt`.

- [ ] **Step 4: Write `auth/jwt.py`**

```python
"""HS256 JWT encode/decode using PyJWT.

`ValueError` is raised for any invalid/expired/malformed token so
callers don't need to import PyJWT exception hierarchy.
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import jwt as pyjwt

from backend.config import get_settings

_ALGORITHM = "HS256"


def encode_token(
    *, user_id: UUID, email: str, ttl: timedelta | None = None
) -> str:
    settings = get_settings()
    if ttl is None:
        ttl = timedelta(seconds=settings.jwt_ttl_seconds)
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
    }
    return pyjwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return pyjwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])
    except pyjwt.PyJWTError as exc:
        raise ValueError(str(exc)) from exc
```

- [ ] **Step 5: Run tests — expect pass**

```bash
(cd backend && uv run pytest tests/test_jwt.py -v)
```

Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/backend/auth/__init__.py backend/src/backend/auth/jwt.py backend/tests/test_jwt.py
git commit -m "$(cat <<'EOF'
phase5: add HS256 JWT encode/decode

PyJWT wrapper that reads jwt_secret/ttl from Settings. Normalizes
PyJWT exceptions to ValueError so callers don't import pyjwt. Covered
by round-trip, tampering-rejection, and expiry tests.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task C2: Google ID-token stub verifier

**Files:**
- Create: `backend/src/backend/auth/google_stub.py`
- Create: `backend/tests/test_google_stub.py`

- [ ] **Step 1: Write `tests/test_google_stub.py`**

```python
import pytest

from backend.auth.google_stub import verify_id_token


def test_stub_treats_id_token_as_email() -> None:
    assert verify_id_token("jet@example.com") == "jet@example.com"


def test_stub_rejects_empty_token() -> None:
    with pytest.raises(ValueError):
        verify_id_token("")


def test_stub_rejects_non_email_shape() -> None:
    with pytest.raises(ValueError):
        verify_id_token("not-an-email")
```

- [ ] **Step 2: Run — expect ImportError**

```bash
(cd backend && uv run pytest tests/test_google_stub.py -v)
```

- [ ] **Step 3: Write `auth/google_stub.py`**

```python
"""Phase-5 stub for Google ID-token verification.

Real implementation lands in Phase 6: verify signature against
Google's JWKS, validate `aud` / `iss` / `exp`, and extract `email`.

The stub treats the raw token string as the authenticated email. Tests
and local dev can post ``{"id_token": "jet@example.com"}`` to
``POST /auth/google``. Any "@"-less input is rejected so tests accidentally
passing a real token shape don't silently succeed.
"""

from email_validator import EmailNotValidError, validate_email


def verify_id_token(raw: str) -> str:
    if not raw:
        raise ValueError("id_token is empty")
    try:
        info = validate_email(raw, check_deliverability=False)
    except EmailNotValidError as exc:
        raise ValueError(f"stub id_token must be an email in Phase 5: {exc}") from exc
    # Lowercase defensively: email local-part case is RFC-technically preserved
    # but real-world auth treats the full email as case-insensitive.
    return info.normalized.lower()
```

- [ ] **Step 4: Run tests — expect pass**

```bash
(cd backend && uv run pytest tests/test_google_stub.py -v)
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/auth/google_stub.py backend/tests/test_google_stub.py
git commit -m "$(cat <<'EOF'
phase5: add Phase-5 Google ID-token stub

verify_id_token(raw) treats input as the authenticated email (Phase 6
replaces with real JWKS verification per contract design §3). Tests
cover the empty and non-email cases.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task C3: `display_id` generation (users + teams)

**Files:**
- Create: `backend/src/backend/services/__init__.py`
- Create: `backend/src/backend/services/display_id.py`
- Create: `backend/tests/test_display_id.py`

- [ ] **Step 1: Write `services/__init__.py`**

```python
"""Service layer — business logic mapping DB rows ↔ contract models."""
```

- [ ] **Step 2: Write the failing test `tests/test_display_id.py`**

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import TeamRow, UserRow
from backend.services.display_id import generate_team_display_id, generate_user_display_id


async def test_user_display_id_from_email(session: AsyncSession) -> None:
    did = await generate_user_display_id(session, email="jetkan@example.com")
    assert did.startswith("U")
    assert 4 <= len(did) <= 8


async def test_user_display_id_collision_suffix(session: AsyncSession) -> None:
    session.add(UserRow(display_id="UJET", email="a@example.com"))
    await session.commit()
    did = await generate_user_display_id(session, email="jet@other.example.com")
    assert did != "UJET"
    assert did.startswith("UJET")


async def test_team_display_id_from_user(session: AsyncSession) -> None:
    did = generate_team_display_id(user_display_id="UJETKAN", used=set())
    assert did == "T-JETKAN"


async def test_team_display_id_collision(session: AsyncSession) -> None:
    did = generate_team_display_id(user_display_id="UJETKAN", used={"T-JETKAN"})
    assert did != "T-JETKAN"
    assert did.startswith("T-JETKAN")


async def test_user_display_id_runs_out_after_100_collisions(
    session: AsyncSession,
) -> None:
    """The 100-attempt cap must RuntimeError cleanly, not corrupt data."""
    from backend.db.models import UserRow
    from backend.services.display_id import generate_user_display_id

    base_taken = ["UJET"] + [f"UJET{n:02d}" for n in range(100)]
    for did in base_taken:
        session.add(UserRow(display_id=did, email=f"{did}@example.com"))
    await session.commit()

    with pytest.raises(RuntimeError, match="Could not allocate|display_id"):
        await generate_user_display_id(session, email="jet@example.com")
```

- [ ] **Step 3: Run — expect ImportError**

```bash
(cd backend && uv run pytest tests/test_display_id.py -v)
```

- [ ] **Step 4: Write `services/display_id.py`**

```python
"""Deterministic `display_id` generation for users and teams.

User display_id: ``U`` + up to 7 [A-Z0-9] derived from the email local
part (vowels kept in the first pass; only dropped on collision to stay
readable). Collisions suffix a two-digit counter; further collisions
extend to three digits. Matches the regex ``^U[A-Z0-9]{3,7}$`` from the
contract.

Team display_id: ``T-`` + the user's display_id minus the leading ``U``,
suffixed on collision. Matches ``^T-[A-Z0-9]{3,10}$``.

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
```

- [ ] **Step 5: Run tests — expect pass**

```bash
(cd backend && uv run pytest tests/test_display_id.py -v)
```

Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/backend/services/__init__.py backend/src/backend/services/display_id.py backend/tests/test_display_id.py
git commit -m "$(cat <<'EOF'
phase5: add user/team display_id generators

Respect the contract regexes (^U[A-Z0-9]{3,7}$, ^T-[A-Z0-9]{3,10}$).
Collision-suffix up to 99; extend if ever needed. Team id derives from
the user's id by stripping the leading U.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task C4: User service — upsert by email + contract mapping

**Files:**
- Create: `backend/src/backend/services/user.py`
- Create: `backend/tests/test_user_service.py`

- [ ] **Step 1: Write `tests/test_user_service.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.user import row_to_contract_user, upsert_user_by_email


async def test_upsert_creates_on_first_sight(session: AsyncSession) -> None:
    user = await upsert_user_by_email(session, email="new@example.com")
    await session.commit()
    assert user.email == "new@example.com"
    assert user.profile_complete is False
    assert user.display_id.startswith("U")


async def test_upsert_is_idempotent(session: AsyncSession) -> None:
    first = await upsert_user_by_email(session, email="same@example.com")
    await session.commit()
    second = await upsert_user_by_email(session, email="same@example.com")
    await session.commit()
    assert first.id == second.id


async def test_row_to_contract_user_derives_name_from_zh_name(session: AsyncSession) -> None:
    user = await upsert_user_by_email(session, email="x@example.com")
    user.zh_name = "簡傑特"
    user.nickname = "Jet"
    contract = row_to_contract_user(user)
    assert contract.name == "簡傑特"


async def test_row_to_contract_user_falls_back_to_nickname(session: AsyncSession) -> None:
    user = await upsert_user_by_email(session, email="y@example.com")
    user.zh_name = None
    user.nickname = "Jet"
    contract = row_to_contract_user(user)
    assert contract.name == "Jet"


async def test_row_to_contract_user_falls_back_to_email_local_part(session: AsyncSession) -> None:
    user = await upsert_user_by_email(session, email="foo@example.com")
    contract = row_to_contract_user(user)
    assert contract.name == "foo"
```

- [ ] **Step 2: Run — expect ImportError**

- [ ] **Step 3: Write `services/user.py`**

```python
"""User service: upsert-by-email on sign-in + DB→contract mapping.

Note: ``profile_complete`` stays ``False`` until ``POST /me/profile``
runs. That flow is in Section D — this module only covers sign-in
creation.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import User as ContractUser
from backend.db.models import UserRow
from backend.services.display_id import generate_user_display_id


async def upsert_user_by_email(session: AsyncSession, *, email: str) -> UserRow:
    """Upsert a UserRow by email; returns existing row or creates a new one."""
    # Belt-and-braces: callers should pre-normalize but we do it here too.
    email = email.lower()
    existing = await session.execute(select(UserRow).where(UserRow.email == email))
    row = existing.scalar_one_or_none()
    if row is not None:
        return row
    display_id = await generate_user_display_id(session, email=email)
    row = UserRow(display_id=display_id, email=email, profile_complete=False)
    session.add(row)
    await session.flush()  # give row an id without committing
    return row


def _derive_name(row: UserRow) -> str:
    if row.zh_name:
        return row.zh_name
    if row.nickname:
        return row.nickname
    return row.email.split("@", 1)[0]


def row_to_contract_user(row: UserRow) -> ContractUser:
    return ContractUser(
        id=row.id,
        display_id=row.display_id,
        email=row.email,
        zh_name=row.zh_name,
        en_name=row.en_name,
        nickname=row.nickname,
        name=_derive_name(row),
        phone=row.phone,
        phone_code=row.phone_code,
        line_id=row.line_id,
        telegram_id=row.telegram_id,
        country=row.country,
        location=row.location,
        avatar_url=row.avatar_url,
        profile_complete=row.profile_complete,
        created_at=row.created_at,
    )
```

- [ ] **Step 4: Run tests — expect pass**

```bash
(cd backend && uv run pytest tests/test_user_service.py -v)
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/services/user.py backend/tests/test_user_service.py
git commit -m "$(cat <<'EOF'
phase5: add user upsert-by-email + DB→contract mapper

upsert_user_by_email() creates-or-returns a UserRow (profile_complete
stays False until POST /me/profile). row_to_contract_user() derives
.name per spec: zh_name → nickname → email local part.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task C5: `current_user` FastAPI dependency

**Files:**
- Create: `backend/src/backend/auth/dependencies.py`

- [ ] **Step 1: Write `auth/dependencies.py`**

```python
"""FastAPI dependency that resolves the current UserRow from a Bearer
token. Raises 401 on missing, malformed, expired, or unknown-user tokens.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.jwt import decode_token
from backend.db.models import UserRow
from backend.db.session import get_session

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Missing or invalid bearer token",
    headers={"WWW-Authenticate": "Bearer"},
)


async def current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: AsyncSession = Depends(get_session),
) -> UserRow:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _UNAUTHORIZED
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = decode_token(token)
    except ValueError as exc:
        raise _UNAUTHORIZED from exc
    try:
        user_id = UUID(claims["sub"])
    except (KeyError, ValueError) as exc:
        raise _UNAUTHORIZED from exc
    user = await session.get(UserRow, user_id)
    if user is None:
        raise _UNAUTHORIZED
    return user
```

- [ ] **Step 2: Commit (tests come with the auth router in C6)**

```bash
git add backend/src/backend/auth/dependencies.py
git commit -m "$(cat <<'EOF'
phase5: add current_user FastAPI dependency

Parses Bearer header, decodes JWT, loads UserRow by sub (UUID). Raises
401 WWW-Authenticate: Bearer on any failure mode. Exercised by the
auth router tests in the next task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task C6: `routers/auth.py` — POST /auth/google, POST /auth/logout

**Files:**
- Create: `backend/src/backend/routers/auth.py`
- Modify: `backend/src/backend/server.py` (mount the router under `/api/v1`)
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Write `tests/test_auth.py`**

```python
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import UserRow


async def test_google_sign_in_creates_user(client: AsyncClient, session: AsyncSession) -> None:
    response = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "jet@example.com"
    assert data["profile_complete"] is False
    assert data["access_token"]
    # DB side-effect:
    result = await session.execute(select(UserRow).where(UserRow.email == "jet@example.com"))
    assert result.scalar_one() is not None


async def test_google_sign_in_is_idempotent_for_existing_email(client: AsyncClient) -> None:
    r1 = await client.post("/api/v1/auth/google", json={"id_token": "same@example.com"})
    r2 = await client.post("/api/v1/auth/google", json={"id_token": "same@example.com"})
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["user"]["id"] == r2.json()["user"]["id"]


async def test_google_sign_in_rejects_empty_token(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/google", json={"id_token": ""})
    assert response.status_code == 401


async def test_google_sign_in_rejects_bad_token_shape(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/google", json={"id_token": "not-an-email"})
    assert response.status_code == 401


async def test_logout_returns_204_with_valid_bearer(client: AsyncClient) -> None:
    sign_in = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    token = sign_in.json()["access_token"]
    response = await client.post(
        "/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 204


async def test_logout_401_without_bearer(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/logout")
    assert response.status_code == 401


async def test_sign_in_case_variations_are_same_user(client: AsyncClient) -> None:
    """Email case must not split into two accounts — classic hijack vector."""
    r1 = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    r2 = await client.post("/api/v1/auth/google", json={"id_token": "Jet@Example.COM"})
    assert r1.status_code == r2.status_code == 200
    assert r1.json()["user"]["id"] == r2.json()["user"]["id"]


async def test_two_sign_ins_yield_two_valid_tokens(client: AsyncClient) -> None:
    """No revocation in Phase 5 — both tokens remain valid until exp."""
    r1 = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    r2 = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    t1, t2 = r1.json()["access_token"], r2.json()["access_token"]
    for t in (t1, t2):
        r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {t}"})
        assert r.status_code == 200


async def test_logout_is_idempotent(client: AsyncClient) -> None:
    """Pin current behavior: double-logout with same token is 204/204."""
    r = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    token = r.json()["access_token"]
    r1 = await client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    r2 = await client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert r1.status_code == 204
    assert r2.status_code == 204


async def test_auth_response_expires_in_matches_token_exp(client: AsyncClient) -> None:
    from backend.auth.jwt import decode_token

    r = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    body = r.json()
    claims = decode_token(body["access_token"])
    assert claims["exp"] - claims["iat"] == body["expires_in"]


@pytest.mark.parametrize(
    "body,expected",
    [
        ({}, 422),
        ({"id_token": None}, 422),
        ({"id_token": "jet@example.com", "extra": "x"}, 422),
    ],
)
async def test_auth_google_rejects_malformed_body(
    client: AsyncClient, body: dict, expected: int
) -> None:
    r = await client.post("/api/v1/auth/google", json=body)
    assert r.status_code == expected
```

- [ ] **Step 2: Write `routers/auth.py`**

```python
"""Auth endpoints: POST /auth/google (sign-in/sign-up) and
POST /auth/logout (best-effort; tokens expire naturally)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.auth.google_stub import verify_id_token
from backend.auth.jwt import encode_token
from backend.config import get_settings
from backend.contract import AuthResponse, GoogleAuthRequest
from backend.db.models import UserRow
from backend.db.session import get_session
from backend.services.user import row_to_contract_user, upsert_user_by_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/google", response_model=AuthResponse)
async def sign_in_with_google(
    body: GoogleAuthRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    try:
        email = verify_id_token(body.id_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc
    user = await upsert_user_by_email(session, email=email)
    await session.commit()
    await session.refresh(user)
    token = encode_token(user_id=user.id, email=user.email)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        expires_in=get_settings().jwt_ttl_seconds,
        user=row_to_contract_user(user),
        profile_complete=user.profile_complete,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(_: UserRow = Depends(current_user)) -> None:
    """No server-side revocation in Phase 5; tokens expire naturally.
    Endpoint exists so the frontend can drop its token on a successful
    200/204 and know the caller's identity was valid at sign-out time."""
```

- [ ] **Step 3: Mount the router in `server.py`**

Edit `backend/src/backend/server.py`. Replace the current `include_router(health.router)` block:

```python
from backend.routers import auth, health

# ...
API_V1 = "/api/v1"

def create_app() -> FastAPI:
    # ...existing settings/middleware code...
    app.include_router(health.router)
    app.include_router(auth.router, prefix=API_V1)
    return app
```

(Keep the module-level `app = create_app()`.)

- [ ] **Step 4: Run tests**

```bash
(cd backend && uv run pytest tests/test_auth.py -v)
```

Expected: 13 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/routers/auth.py backend/src/backend/server.py backend/tests/test_auth.py
git commit -m "$(cat <<'EOF'
phase5: add POST /auth/google and POST /auth/logout

Wires the Google stub → upsert_user_by_email → JWT issuance chain.
Logout is a best-effort 204 (no revocation in Phase 5 per spec §3).
Router mounted under /api/v1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task C7: `routers/me.py` — GET /me only (profile create/patch in Section D)

**Files:**
- Create: `backend/src/backend/routers/me.py`
- Modify: `backend/src/backend/server.py` (mount)
- Create: `backend/tests/test_me.py`

- [ ] **Step 1: Write `tests/test_me.py`**

```python
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def test_get_me_returns_current_user(client: AsyncClient) -> None:
    sign_in = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    token = sign_in.json()["access_token"]

    response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "jet@example.com"
    assert data["profile_complete"] is False
    assert data["name"] == "jet"  # email-local-part fallback


async def test_get_me_401_without_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/me")
    assert response.status_code == 401


async def test_401_when_user_was_deleted(
    client: AsyncClient, session: AsyncSession
) -> None:
    """Valid JWT whose `sub` points at a deleted user → 401, not 200 with None."""
    from sqlalchemy import delete
    from backend.db.models import UserRow

    r = await client.post("/api/v1/auth/google", json={"id_token": "jet@example.com"})
    token = r.json()["access_token"]

    await session.execute(delete(UserRow).where(UserRow.email == "jet@example.com"))
    await session.commit()

    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


@pytest.mark.parametrize(
    "header_value",
    [
        "",  # no header at all (via missing key)
        "Basic dXNlcjpwYXNz",  # wrong scheme
        "Bearer",  # scheme-only, no token
        "Bearer ",  # empty token
        "Bearer not-a-jwt",  # garbage token
    ],
)
async def test_me_rejects_bad_bearer(client: AsyncClient, header_value: str) -> None:
    headers = {"Authorization": header_value} if header_value else {}
    r = await client.get("/api/v1/me", headers=headers)
    assert r.status_code == 401


async def test_me_rejects_expired_bearer(client: AsyncClient) -> None:
    from datetime import timedelta
    from backend.auth.jwt import encode_token
    from uuid import uuid4

    expired = encode_token(user_id=uuid4(), email="x@e.com", ttl=timedelta(seconds=-3600))
    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {expired}"})
    assert r.status_code == 401


async def test_401_sets_www_authenticate_bearer(client: AsyncClient) -> None:
    r = await client.get("/api/v1/me")
    assert r.status_code == 401
    assert r.headers.get("WWW-Authenticate") == "Bearer"
```

- [ ] **Step 2: Write `routers/me.py`**

```python
"""Me endpoints (current user). Profile completion and patch land in
Section D; Phase 5 starts with just GET /me."""

from fastapi import APIRouter, Depends

from backend.auth.dependencies import current_user
from backend.contract import User as ContractUser
from backend.db.models import UserRow
from backend.services.user import row_to_contract_user

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=ContractUser)
async def get_me(me: UserRow = Depends(current_user)) -> ContractUser:
    return row_to_contract_user(me)
```

- [ ] **Step 3: Mount in `server.py`**

```python
from backend.routers import auth, health, me

# ...in create_app()...
app.include_router(me.router, prefix=API_V1)
```

- [ ] **Step 4: Run tests**

```bash
(cd backend && uv run pytest tests/test_me.py -v)
```

Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/routers/me.py backend/src/backend/server.py backend/tests/test_me.py
git commit -m "$(cat <<'EOF'
phase5: add GET /me (current user read)

Exercises current_user dep + row_to_contract_user. Profile mutation
lands in Section D.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist

**Spec coverage — endpoints shipped by this plan:**

| Endpoint | Task |
|---|---|
| `POST /auth/google` | C6 |
| `POST /auth/logout` | C6 |
| `GET /me` | C7 |

**Placeholder scan:** No `TBD` / `implement later` / "similar to task N" / "add error handling" / "write tests for the above" placeholders remain. Every code step ships complete, runnable code.

**Type consistency:**
- `current_user` FastAPI dependency returns `UserRow` everywhere.
- `decode_token` raises `ValueError` (never a PyJWT-specific exception).

**Known gaps surfaced during plan writing (documented, not blocking):**

- **`display_id` generation races.** `generate_user_display_id` / `generate_team_display_id` load all taken ids, pick one, then insert — the select+insert isn't transactional, so two concurrent sign-ups with the same email-derived base can both pick the same candidate and the loser hits a unique-constraint 500. Acceptable for Phase-5 single-tenant dev; a retry-on-IntegrityError loop (or `INSERT ... ON CONFLICT` with a regenerated suffix) is the right fix for Phase 6.

**Known gaps that remain for later phases:**

- **Replay / revocation:** tokens survive until `exp` regardless of logout. Document as "best-effort logout — revocation list / short TTL + refresh deferred to Phase 6".
- **`iss` / `aud` claims** are not set or verified. Single-service HS256 only; revisit if tokens cross service boundaries.
- **Rate limiting** on `/auth/google` deferred.

**Resolved during review (previously flagged as gaps):**

- ✅ **JWT secret prod safeguard.** `get_settings()` (from 5a) raises if `APP_ENV=prod` and `JWT_SECRET` is still the dev default, so a deploy that forgets to set it fails fast. Forward-compat note: Phase 5a is separately bumping `jwt_secret` to `min_length=32`; this plan is compatible — it reads the secret via `get_settings().jwt_secret` regardless of validator constraints.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-19-phase-5b-auth.md`.**

The plan lives in the main repo so it's visible across worktrees. Before executing, create a worktree under `.worktree/phase-5b-auth` (per user's global instruction) so Phase-5b work stays isolated.

Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task with a two-stage review between them. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks sequentially in the current session with batch checkpoints. Use `superpowers:executing-plans`. Faster wall-clock, but the main session's context fills up quickly.

**After 5b merges, proceed to phase-5c-teams.**

**Which approach would you like?**
