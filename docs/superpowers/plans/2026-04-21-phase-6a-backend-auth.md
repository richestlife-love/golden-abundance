# Phase 6a — Backend Auth Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 5b email-stub auth with a real Supabase JWKS verifier. Delete `POST /auth/google`, `POST /auth/logout`, `backend/auth/google_stub.py`, and `backend/auth/jwt.py`. Rewire `current_user` to verify RS256 JWTs issued by Supabase and resolve (or upsert) a `UserRow` keyed by Supabase's `auth.users.id`. All existing Phase-5 integration tests keep passing by minting RS256 tokens through a new test fixture.

**Prereqs:** Phase 5 merged (all of 5a–5e). Supabase project created with asymmetric JWT signing keys enabled (§0 below is the manual part).

**Architecture:** FastAPI stays as the sole authoritative API. Supabase becomes the identity issuer only — our backend never sees OAuth flow state, only incoming JWTs on `Authorization: Bearer`. JWT verification uses PyJWT's `PyJWKClient` against Supabase's public JWKS endpoint (cached in-process). The existing `UserRow` table gains no schema changes; its `id` column now always stores Supabase's `auth.users.id` UUID instead of a Python-generated `uuid4()`.

**Tech Stack:** Python 3.14, FastAPI, SQLModel (SQLAlchemy 2.0 async), psycopg3, Alembic, PyJWT `>=2.12.1` (with the `crypto` extra for RS256), pytest + pytest-asyncio + httpx + testcontainers[postgresql], `cryptography` (transitive via `pyjwt[crypto]`) for local RSA keypair generation in tests.

**Spec:** `docs/superpowers/specs/2026-04-21-phase-6-7-auth-deploy-design.md` §4 (Sub-plan 6a).

**Exit criteria:**
- `just -f backend/justfile ci` green (lint + format + typecheck + contract-validate + pytest with ≥90% coverage).
- `backend/src/backend/auth/google_stub.py` + `backend/src/backend/auth/jwt.py` + `backend/src/backend/routers/auth.py` deleted.
- `grep -r 'JWT_SECRET' backend/src/ backend/tests/` returns no matches.
- `grep -r 'auth/google\|/auth/logout' backend/src/` returns no matches.
- Any request to `GET /api/v1/me` with a minted RS256 token (via the new `mint_access_token` fixture) returns 200 + the upserted user.
- A never-seen-before `sub` claim on first request auto-materializes a fresh `UserRow` with `profile_complete=False`.

---

## Section 0 — Manual Supabase setup (one-time; do this first)

These steps happen in the Supabase dashboard; they produce the env var values the plan's code depends on. Skip if already done by the repo owner for a shared dev/staging project.

- [ ] **Step 1: Create Supabase project**
  - Open https://supabase.com/dashboard → New Project.
  - Record: project ref (e.g., `abcdef0123456789`), anon key, service-role key (DO NOT paste service-role into any env file — dashboard only).

- [ ] **Step 2: Enable asymmetric JWT signing keys**
  - Project Settings → JWT → Signing Keys → rotate into an RS256 signing key. Record JWKS URL: `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`.

- [ ] **Step 3: Configure URL allowlist**
  - Authentication → URL Configuration:
    - Site URL: `https://jinfuyou.app` (will set in 7a)
    - Additional redirect URLs: `http://localhost:5173/auth/callback`

- [ ] **Step 4: Create `app_backend` role for local dev smoke**
  - Skip for plan 6a — this role is only used from deployed envs. Local dev + tests keep using the existing docker-compose Postgres (no Supabase connection needed).

---

## Scoping decisions locked before drafting

| Decision | Choice | Why |
|---|---|---|
| JWT library | `pyjwt[crypto]>=2.12.1` (same major as today; adds the `cryptography` extra) | Already in `pyproject.toml`; keeps the dep surface small. |
| JWKS client | `PyJWKClient(url, cache_keys=True, lifespan=3600)` | First-party PyJWT; in-process LRU cache means one fetch per hour per worker. |
| Algorithm | RS256 | Supabase's asymmetric option. No HS256 fallback. |
| Issuer check | `f"{SUPABASE_URL}/auth/v1"` | Supabase's documented `iss` shape. |
| Audience check | `"authenticated"` | Supabase's default `aud` for signed-in users. |
| UserRow PK | `auth.users.id` UUID from Supabase | One identity namespace; no local UUID → Supabase UUID mapping table. |
| User upsert strategy | `current_user` dep calls `upsert_user_by_supabase_identity` on first cache miss | Lazy materialization; no admin sync job needed. |
| Test token minting | Session-scoped RSA keypair + stubbed `_jwks_client()` via monkeypatch | Single truth source for test signing; no real Supabase dependency in CI. |
| Seed DEMO_USERS UUIDs | Stable `UUID(int=i+1)` per user (1..6) | Deterministic; re-runnable; matches mint helper default. |
| Backward-compat shims | None | Email-stub callers are all test code; migrate them atomically. |

---

## File plan

Files created (C), modified (M), or deleted (D). Paths relative to repo root `/Users/Jet/Developer/golden-abundance-lite`.

### `backend/src/backend/` — source modules

| Path | Action | Contents |
|---|---|---|
| `backend/src/backend/auth/supabase.py` | C | `verify_supabase_jwt()`; internal `_jwks_client()` with `lru_cache` |
| `backend/src/backend/contract/auth.py` | C | `SupabaseClaims` pydantic model |
| `backend/src/backend/contract/__init__.py` | M | Re-export `SupabaseClaims` |
| `backend/src/backend/auth/__init__.py` | M | Drop docstring ref to HS256 stub; mention JWKS verifier |
| `backend/src/backend/auth/dependencies.py` | M | `current_user` uses `verify_supabase_jwt` + upsert-on-miss |
| `backend/src/backend/auth/google_stub.py` | D | Stub is gone |
| `backend/src/backend/auth/jwt.py` | D | HS256 encode/decode is gone |
| `backend/src/backend/routers/auth.py` | D | `/auth/google` and `/auth/logout` are gone |
| `backend/src/backend/services/user.py` | M | Rename + reshape upsert to take `(auth_user_id, email)` |
| `backend/src/backend/services/__init__.py` | M | (no re-export of upsert changes — just renames) |
| `backend/src/backend/server.py` | M | Remove `auth` router import + `include_router(auth.router)` |
| `backend/src/backend/config.py` | M | Remove `jwt_secret`/`jwt_ttl_seconds`; add Supabase fields |
| `backend/src/backend/db/models.py` | M | `UserRow.id` loses `default_factory=uuid4` |
| `backend/src/backend/seed.py` | M | DEMO_USERS gain stable UUIDs (`UUID(int=i+1)`); upsert call rewired |
| `backend/.env.example` | M | Swap env var block |
| `backend/pyproject.toml` | M | `pyjwt` → `pyjwt[crypto]`; drop transitive `email-validator` usage notes |

### `backend/tests/` — tests

| Path | Action | Contents |
|---|---|---|
| `backend/tests/auth/test_supabase.py` | C | Verifier happy + failure paths |
| `backend/tests/auth/test_jwt.py` | D | HS256 gone |
| `backend/tests/auth/test_google_stub.py` | D | Stub gone |
| `backend/tests/routers/test_auth.py` | D | `/auth/google` endpoint gone |
| `backend/tests/routers/test_auth_required.py` | M | 401 shape unchanged; token fixture swap |
| `backend/tests/routers/test_me.py` | M | Upsert-on-first-request assertion; token fixture swap |
| `backend/tests/routers/test_me_profile.py` | M | Token fixture swap only |
| `backend/tests/routers/test_me_teams.py` | M | Token fixture swap only |
| `backend/tests/routers/test_leaderboard.py` | M | Token fixture swap only |
| `backend/tests/routers/test_news.py` | M | Token fixture swap only |
| `backend/tests/routers/test_tasks_read.py` | M | Token fixture swap only |
| `backend/tests/routers/test_tasks_submit.py` | M | Token fixture swap only |
| `backend/tests/routers/test_teams_*.py` | M | Token fixture swap only |
| `backend/tests/routers/test_rewards_read.py` | M | Token fixture swap only |
| `backend/tests/services/test_user_service.py` | M | Verify renamed upsert fn |
| `backend/tests/helpers.py` | M | `sign_in()` mints a JWT instead of POSTing to `/auth/google` |
| `backend/tests/conftest.py` | M | Add `rsa_test_keypair`, `mint_access_token`, autouse `stub_jwks` fixtures |
| `backend/tests/test_config.py` | M | Cover new Supabase settings validation |

---

## Section A — Config + Contract shape

**Exit criteria:** `Settings` rejects `APP_ENV=prod` with missing `SUPABASE_URL`; `SupabaseClaims` round-trips through `model_validate`.

### Task A1: Add Supabase fields to `Settings`

**Files:**
- Modify: `backend/src/backend/config.py`
- Modify: `backend/.env.example`
- Modify: `backend/tests/test_config.py`

- [ ] **Step 1: Write the failing test in `backend/tests/test_config.py`**

Add these tests; keep existing ones untouched for now (they cover `jwt_secret` and will be updated in Step 3 of Task D2 once we actually delete that field):

```python
def test_settings_requires_supabase_url_in_prod(monkeypatch) -> None:
    from backend.config import get_settings

    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.setenv("JWT_SECRET", "x" * 32)  # transitional while JWT_SECRET still exists

    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        get_settings()


def test_settings_derives_jwks_url_from_supabase_url(monkeypatch) -> None:
    from backend.config import get_settings

    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.supabase_jwks_url == "https://abc.supabase.co/auth/v1/.well-known/jwks.json"
    assert settings.supabase_issuer == "https://abc.supabase.co/auth/v1"
    assert settings.supabase_jwt_aud == "authenticated"
```

- [ ] **Step 2: Run — expect AttributeError on `supabase_jwks_url` / missing RuntimeError**

```bash
(cd backend && uv run pytest tests/test_config.py::test_settings_derives_jwks_url_from_supabase_url -v)
```

Expected: FAIL — `AttributeError` on `settings.supabase_jwks_url`.

- [ ] **Step 3: Update `backend/src/backend/config.py`**

Full file:

```python
"""Runtime settings loaded from environment variables.

`Settings` is a pydantic-settings model; `get_settings()` returns a
process-wide cached instance so FastAPI deps can depend on it without
re-reading the environment on every call.

Boot safety: ``get_settings()`` refuses to return a production-env
instance missing ``SUPABASE_URL`` — a deploy that forgets to set it
fails fast at app import rather than silently accepting unverified
tokens.
"""

from functools import cached_property, lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        enable_decoding=False,
    )

    database_url: str = Field(
        default="postgresql+psycopg://app:app@localhost:5432/app",
        description="SQLAlchemy URL (psycopg3 driver).",
    )
    supabase_url: str | None = Field(
        default=None,
        description="Supabase project base URL, e.g. https://<ref>.supabase.co. Required when APP_ENV=prod.",
    )
    supabase_jwt_aud: str = Field(default="authenticated")
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://localhost:8000",
        ],
    )
    app_env: Literal["dev", "test", "prod"] = "dev"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v: object) -> object:
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @cached_property
    def supabase_issuer(self) -> str:
        if self.supabase_url is None:
            raise RuntimeError("SUPABASE_URL is not configured")
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @cached_property
    def supabase_jwks_url(self) -> str:
        return f"{self.supabase_issuer}/.well-known/jwks.json"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    if settings.app_env == "prod" and settings.supabase_url is None:
        raise RuntimeError("SUPABASE_URL must be set when APP_ENV=prod")
    return settings
```

Note: we leave `JWT_SECRET` *out* entirely. The old dev default gets removed; any test that still reads `JWT_SECRET` via `monkeypatch.setenv` will keep working (pydantic-settings ignores unknown env keys because of `extra="ignore"`), and Task D2 finishes the sweep.

- [ ] **Step 4: Update `backend/.env.example`**

Replace the full contents with:

```env
# Copy to `.env` and fill in values for local overrides.
# pydantic-settings loads `.env` on `Settings()` construction; see src/backend/config.py.

# SQLAlchemy URL for the app database (psycopg3 driver).
DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/app

# Supabase project base URL. Required when APP_ENV=prod. Leave unset for local
# dev + tests; they don't talk to Supabase.
SUPABASE_URL=https://your-project-ref.supabase.co

# Audience claim enforced on incoming JWTs. Defaults to Supabase's "authenticated".
SUPABASE_JWT_AUD=authenticated

# Comma-separated list of allowed CORS origins (also accepts a JSON array).
CORS_ORIGINS=http://localhost:5173,http://localhost:8000

# Runtime environment: one of `dev`, `test`, `prod`.
APP_ENV=dev
```

- [ ] **Step 5: Run — expect PASS for new tests**

```bash
(cd backend && uv run pytest tests/test_config.py -v)
```

Expected: new tests pass. Existing `test_settings_*` tests that rely on `jwt_secret` will fail — that's expected and fixed in Task D2.

- [ ] **Step 6: Commit**

```bash
git add backend/src/backend/config.py backend/.env.example backend/tests/test_config.py
git commit -m "feat(backend): add Supabase settings fields (Phase 6a)"
```

### Task A2: SupabaseClaims contract model

**Files:**
- Create: `backend/src/backend/contract/auth.py`
- Modify: `backend/src/backend/contract/__init__.py`
- Create: `backend/tests/auth/__init__.py` (verify still exists)
- Create: `backend/tests/auth/test_supabase_claims.py`

- [ ] **Step 1: Write the failing test in `backend/tests/auth/test_supabase_claims.py`**

```python
from uuid import UUID

import pytest
from pydantic import ValidationError

from backend.contract.auth import SupabaseClaims


def test_claims_round_trip() -> None:
    raw = {
        "sub": "11111111-2222-3333-4444-555555555555",
        "email": "jet@example.com",
        "aud": "authenticated",
        "exp": 1_800_000_000,
        "iat": 1_700_000_000,
        "role": "authenticated",
    }
    claims = SupabaseClaims.model_validate(raw)
    assert claims.sub == UUID("11111111-2222-3333-4444-555555555555")
    assert claims.email == "jet@example.com"
    assert claims.aud == "authenticated"


def test_claims_rejects_non_uuid_sub() -> None:
    raw = {
        "sub": "not-a-uuid",
        "email": "e@x.com",
        "aud": "authenticated",
        "exp": 1_800_000_000,
        "iat": 1_700_000_000,
    }
    with pytest.raises(ValidationError):
        SupabaseClaims.model_validate(raw)


def test_claims_rejects_missing_email() -> None:
    raw = {
        "sub": "11111111-2222-3333-4444-555555555555",
        "aud": "authenticated",
        "exp": 1_800_000_000,
        "iat": 1_700_000_000,
    }
    with pytest.raises(ValidationError):
        SupabaseClaims.model_validate(raw)


def test_claims_ignores_unknown_keys() -> None:
    """Supabase adds user_metadata / app_metadata / role — we don't care about any of those."""
    raw = {
        "sub": "11111111-2222-3333-4444-555555555555",
        "email": "e@x.com",
        "aud": "authenticated",
        "exp": 1_800_000_000,
        "iat": 1_700_000_000,
        "user_metadata": {"full_name": "Anything"},
        "app_metadata": {"provider": "google"},
    }
    claims = SupabaseClaims.model_validate(raw)
    assert claims.sub == UUID("11111111-2222-3333-4444-555555555555")
```

- [ ] **Step 2: Run — expect ImportError**

```bash
(cd backend && uv run pytest tests/auth/test_supabase_claims.py -v)
```

Expected: FAIL — `ImportError: backend.contract.auth`.

- [ ] **Step 3: Create `backend/src/backend/contract/auth.py`**

```python
"""Wire-format shapes for auth flow.

`SupabaseClaims` is the deserialized form of a Supabase-issued JWT's
payload. Only the fields the backend enforces or reads are declared;
extra keys (user_metadata, app_metadata, role, session_id, etc.) are
ignored by pydantic's default.
"""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SupabaseClaims(BaseModel):
    """Subset of a Supabase access-token's JWT payload.

    ``email`` is plain ``str`` (not ``EmailStr``) because Supabase has
    already validated it on issuance; re-validating would only add a
    runtime dep on ``email-validator`` for zero security win.
    """

    model_config = ConfigDict(extra="ignore")

    sub: UUID
    email: str
    aud: str
    exp: int
    iat: int
```

- [ ] **Step 4: Update `backend/src/backend/contract/__init__.py`**

Add to the re-export block (preserve existing imports; this is an addition):

```python
from backend.contract.auth import SupabaseClaims  # noqa: E402
```

And add `"SupabaseClaims"` to `__all__` if one is declared, keeping the list alphabetized.

- [ ] **Step 5: Run — expect PASS**

```bash
(cd backend && uv run pytest tests/auth/test_supabase_claims.py -v)
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/backend/contract/auth.py backend/src/backend/contract/__init__.py backend/tests/auth/test_supabase_claims.py
git commit -m "feat(contract): add SupabaseClaims model (Phase 6a)"
```

---

## Section B — Test fixtures: RSA keypair + minted tokens + stubbed JWKS

**Exit criteria:** `mint_access_token(user_id=..., email=...)` returns an RS256-signed JWT that a (to-be-written) `verify_supabase_jwt` will accept once the JWKS client is stubbed to return the test public key.

### Task B1: Test fixtures in conftest

**Files:**
- Modify: `backend/pyproject.toml` — switch `pyjwt>=2.12.1` to `pyjwt[crypto]>=2.12.1`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Update `backend/pyproject.toml` dependencies block**

Replace the `pyjwt` line in `dependencies`:

```toml
  "pyjwt[crypto]>=2.12.1",
```

Run `uv sync` to update the lockfile:

```bash
(cd backend && uv sync --all-extras --dev)
```

Expected: `cryptography` added to `uv.lock` as a resolved dep.

- [ ] **Step 2: Write the failing fixture test**

Add to `backend/tests/conftest.py` AFTER existing fixtures (do NOT remove anything yet; the new fixtures coexist with the old ones until Task D2):

```python
# -------------------------------------------------------------------
# Phase 6a fixtures: RSA keypair + Supabase-shaped JWT minter
# -------------------------------------------------------------------

import json
import time
from uuid import UUID, uuid4

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

SUPABASE_TEST_URL = "https://test-ref.supabase.co"
SUPABASE_TEST_AUD = "authenticated"
SUPABASE_TEST_ISS = f"{SUPABASE_TEST_URL}/auth/v1"
SUPABASE_TEST_KID = "test-kid-2026"


@pytest.fixture(scope="session")
def rsa_test_keypair() -> tuple[str, str]:
    """Generate a fresh 2048-bit RSA keypair for the test session.

    Returns (private_pem, public_pem). 2048 bits is overkill for test
    signing speed but matches the keyspace Supabase uses in prod.
    """
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public_pem = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    return private_pem, public_pem


@pytest.fixture
def mint_access_token(rsa_test_keypair):
    """Mint an RS256-signed JWT mimicking Supabase's claim shape.

    Call as `mint_access_token(user_id=UUID(...), email="e@x.com")`.
    Optional keyword overrides (`exp`, `iat`, `aud`, `iss`, `kid`) let
    tests forge expired / mis-issued tokens for negative-path coverage.
    """
    private_pem, _public_pem = rsa_test_keypair

    def _mint(
        *,
        user_id: UUID | None = None,
        email: str = "test@example.com",
        exp: int | None = None,
        iat: int | None = None,
        aud: str = SUPABASE_TEST_AUD,
        iss: str = SUPABASE_TEST_ISS,
        kid: str = SUPABASE_TEST_KID,
    ) -> str:
        import jwt as pyjwt

        now = int(time.time())
        payload = {
            "sub": str(user_id or uuid4()),
            "email": email,
            "aud": aud,
            "iss": iss,
            "iat": iat if iat is not None else now,
            "exp": exp if exp is not None else now + 3600,
            "role": "authenticated",
        }
        return pyjwt.encode(payload, private_pem, algorithm="RS256", headers={"kid": kid})

    return _mint


@pytest.fixture(autouse=True)
def stub_jwks(rsa_test_keypair, monkeypatch):
    """Route Supabase JWKS lookups to the session's test public key.

    Applied autouse because every integration test that mints a token
    needs it; opting out is as simple as not minting a token.
    """
    _private_pem, public_pem = rsa_test_keypair

    monkeypatch.setenv("SUPABASE_URL", SUPABASE_TEST_URL)
    get_settings.cache_clear()

    # Patch the JWKS client AFTER auth/supabase.py exists (Task B2). Until
    # then this monkeypatch target doesn't exist yet; guard with a try.
    try:
        from backend.auth import supabase as _supabase_mod  # noqa: F401

        import jwt as pyjwt
        from cryptography.hazmat.primitives import serialization as _ser
        pub_key = _ser.load_pem_public_key(public_pem.encode())

        class _StubJWKClient:
            def get_signing_key_from_jwt(self, _token: str):
                class _Key:
                    key = pub_key
                return _Key()

        monkeypatch.setattr(
            "backend.auth.supabase._jwks_client",
            lambda: _StubJWKClient(),
        )
    except ImportError:
        # Module hasn't been written yet; no-op until Task B2.
        pass

    yield
```

- [ ] **Step 3: Confirm no new failures**

```bash
(cd backend && uv run pytest tests/ -x --ignore=tests/auth/test_supabase.py 2>&1 | tail -30)
```

Expected: existing tests still pass (the stub_jwks autouse fixture is a no-op while `backend.auth.supabase` doesn't exist).

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/tests/conftest.py
git commit -m "test(backend): add RSA keypair + mint_access_token fixtures (Phase 6a)"
```

---

## Section C — JWKS verifier

**Exit criteria:** `verify_supabase_jwt()` accepts RS256 tokens signed by the test key, rejects expired / wrong-iss / wrong-aud / malformed / `alg: none`.

### Task C1: Write the verifier test

**Files:**
- Create: `backend/tests/auth/test_supabase.py`

- [ ] **Step 1: Write the failing test `backend/tests/auth/test_supabase.py`**

```python
"""Tests for the Supabase JWKS-based JWT verifier."""

import time
from uuid import UUID

import pytest

from backend.auth.supabase import verify_supabase_jwt
from backend.contract.auth import SupabaseClaims


def test_verify_accepts_valid_token(mint_access_token) -> None:
    user_id = UUID(int=42)
    token = mint_access_token(user_id=user_id, email="jet@example.com")

    claims = verify_supabase_jwt(token)

    assert isinstance(claims, SupabaseClaims)
    assert claims.sub == user_id
    assert claims.email == "jet@example.com"
    assert claims.aud == "authenticated"


def test_verify_rejects_expired_token(mint_access_token) -> None:
    token = mint_access_token(exp=int(time.time()) - 60)
    with pytest.raises(ValueError, match=r"(?i)expired"):
        verify_supabase_jwt(token)


def test_verify_rejects_wrong_issuer(mint_access_token) -> None:
    token = mint_access_token(iss="https://evil.example.com/auth/v1")
    with pytest.raises(ValueError):
        verify_supabase_jwt(token)


def test_verify_rejects_wrong_audience(mint_access_token) -> None:
    token = mint_access_token(aud="service_role")
    with pytest.raises(ValueError):
        verify_supabase_jwt(token)


def test_verify_rejects_malformed_token() -> None:
    with pytest.raises(ValueError):
        verify_supabase_jwt("not.a.jwt")


def test_verify_rejects_alg_none() -> None:
    """Historic PyJWT vulnerability — ``alg: none`` must never be accepted."""
    import jwt as pyjwt

    forged = pyjwt.encode(
        {"sub": str(UUID(int=1)), "email": "x@x.com", "aud": "authenticated",
         "iss": "https://test-ref.supabase.co/auth/v1", "exp": 9_999_999_999, "iat": 0},
        key="",
        algorithm="none",
    )
    with pytest.raises(ValueError):
        verify_supabase_jwt(forged)


def test_verify_rejects_hs256_signed_token() -> None:
    """Attacker can't downgrade RS256 → HS256 by signing with a guessed secret."""
    import jwt as pyjwt

    forged = pyjwt.encode(
        {"sub": str(UUID(int=1)), "email": "x@x.com", "aud": "authenticated",
         "iss": "https://test-ref.supabase.co/auth/v1", "exp": 9_999_999_999, "iat": 0},
        key="guessed-secret",
        algorithm="HS256",
    )
    with pytest.raises(ValueError):
        verify_supabase_jwt(forged)
```

- [ ] **Step 2: Run — expect ImportError**

```bash
(cd backend && uv run pytest tests/auth/test_supabase.py -v)
```

Expected: FAIL — `ImportError: backend.auth.supabase`.

### Task C2: Write the verifier

**Files:**
- Create: `backend/src/backend/auth/supabase.py`

- [ ] **Step 1: Create `backend/src/backend/auth/supabase.py`**

```python
"""Supabase JWKS-based JWT verification.

Supabase signs access tokens with an asymmetric RS256 key. The public
key(s) are served at ``<SUPABASE_URL>/auth/v1/.well-known/jwks.json``.
PyJWT's ``PyJWKClient`` fetches and caches the JWKS in-process so
verification is cheap after the first call.

All verification failures surface as ``ValueError`` so callers (the
``current_user`` dep) don't import PyJWT's exception hierarchy.
"""

from functools import lru_cache

import jwt as pyjwt
from jwt import PyJWKClient

from backend.config import get_settings
from backend.contract.auth import SupabaseClaims

_ALGORITHMS = ["RS256"]


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    return PyJWKClient(
        get_settings().supabase_jwks_url,
        cache_keys=True,
        lifespan=3600,
    )


def verify_supabase_jwt(token: str) -> SupabaseClaims:
    settings = get_settings()
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token).key
        raw = pyjwt.decode(
            token,
            signing_key,
            algorithms=_ALGORITHMS,
            audience=settings.supabase_jwt_aud,
            issuer=settings.supabase_issuer,
        )
    except pyjwt.PyJWTError as exc:
        raise ValueError(str(exc)) from exc
    except Exception as exc:  # PyJWKClient raises bare RuntimeError on malformed headers
        raise ValueError(str(exc)) from exc
    return SupabaseClaims.model_validate(raw)
```

- [ ] **Step 2: Update `backend/src/backend/auth/__init__.py`**

Replace the docstring to reflect the new reality:

```python
"""Authentication helpers: Supabase JWKS-based JWT verification.

Real OAuth flow is owned by the frontend's Supabase SDK; the backend
only verifies incoming ``Authorization: Bearer`` tokens against
Supabase's published JWKS.
"""
```

- [ ] **Step 3: Run — expect PASS**

```bash
(cd backend && uv run pytest tests/auth/test_supabase.py -v)
```

Expected: all 7 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/backend/auth/supabase.py backend/src/backend/auth/__init__.py backend/tests/auth/test_supabase.py
git commit -m "feat(auth): Supabase JWKS verifier (Phase 6a)"
```

---

## Section D — Rewire `current_user` + delete legacy surface

**Exit criteria:** `Authorization: Bearer <minted>` resolves to a `UserRow`; first request with never-seen `sub` upserts a new row. `/auth/google`, `/auth/logout`, `google_stub.py`, `jwt.py`, their test files — all gone.

### Task D1: Rename upsert function + flush unused defaults

**Files:**
- Modify: `backend/src/backend/services/user.py`
- Modify: `backend/src/backend/db/models.py`
- Modify: `backend/tests/services/test_user_service.py`

- [ ] **Step 1: Write the failing test**

Replace `backend/tests/services/test_user_service.py` existing upsert tests with:

```python
"""Tests for backend.services.user."""

from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import UserRow
from backend.services.user import (
    derive_user_name,
    row_to_contract_user,
    upsert_user_by_supabase_identity,
)


@pytest.mark.asyncio
async def test_upsert_creates_new_row_with_supabase_id(session: AsyncSession) -> None:
    auth_id = UUID(int=1001)
    row = await upsert_user_by_supabase_identity(
        session, auth_user_id=auth_id, email="jet@example.com",
    )
    assert row.id == auth_id
    assert row.email == "jet@example.com"
    assert row.display_id.startswith("JET")
    assert row.profile_complete is False


@pytest.mark.asyncio
async def test_upsert_is_idempotent_on_same_auth_id(session: AsyncSession) -> None:
    auth_id = UUID(int=1002)
    r1 = await upsert_user_by_supabase_identity(
        session, auth_user_id=auth_id, email="jet@example.com",
    )
    await session.commit()
    r2 = await upsert_user_by_supabase_identity(
        session, auth_user_id=auth_id, email="jet@example.com",
    )
    assert r1.id == r2.id
    assert r1.display_id == r2.display_id


@pytest.mark.asyncio
async def test_upsert_reuses_existing_row_on_auth_id_match(session: AsyncSession) -> None:
    """If a row with this UUID already exists (e.g., seeded), reuse it rather than create a collision."""
    auth_id = UUID(int=1003)
    session.add(UserRow(id=auth_id, display_id="SEED1", email="seeded@example.com"))
    await session.commit()

    row = await upsert_user_by_supabase_identity(
        session, auth_user_id=auth_id, email="seeded@example.com",
    )
    assert row.id == auth_id
    assert row.display_id == "SEED1"  # unchanged


def test_derive_user_name_falls_back_to_email_local_part() -> None:
    row = UserRow(id=UUID(int=1), display_id="X", email="jet.kan@example.com")
    assert derive_user_name(row) == "jet.kan"


def test_derive_user_name_prefers_zh_name() -> None:
    row = UserRow(id=UUID(int=1), display_id="X", email="x@example.com", zh_name="金杰", nickname="Jet")
    assert derive_user_name(row) == "金杰"


def test_row_to_contract_user_maps_every_field() -> None:
    from datetime import UTC, datetime
    row = UserRow(
        id=UUID(int=1),
        display_id="JET1",
        email="jet@example.com",
        zh_name="金杰",
        profile_complete=True,
        created_at=datetime(2026, 4, 21, tzinfo=UTC),
    )
    contract = row_to_contract_user(row)
    assert contract.id == row.id
    assert contract.display_id == "JET1"
    assert contract.zh_name == "金杰"
    assert contract.name == "金杰"
    assert contract.profile_complete is True
```

- [ ] **Step 2: Run — expect ImportError on `upsert_user_by_supabase_identity`**

```bash
(cd backend && uv run pytest tests/services/test_user_service.py -v)
```

Expected: FAIL — `ImportError`.

- [ ] **Step 3: Rewrite `backend/src/backend/services/user.py`**

```python
"""User service: upsert-by-Supabase-identity + DB→contract mapping.

``UserRow.id`` holds Supabase's ``auth.users.id`` UUID. ``current_user``
calls ``upsert_user_by_supabase_identity`` on its first request for a
given ``sub`` so freshly-signed-up users get an app-side row the moment
they hit any authed endpoint.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import User as ContractUser
from backend.db.models import UserRow
from backend.services.display_id import generate_user_display_id


async def upsert_user_by_supabase_identity(
    session: AsyncSession,
    *,
    auth_user_id: UUID,
    email: str,
) -> UserRow:
    """Return the existing ``UserRow`` for ``auth_user_id`` or create one.

    Caller is responsible for committing — this function only ``flush()``es
    so the new row has relationships but sits in the session's identity
    map. Concurrent first-sign-in requests for the same ``auth_user_id``
    can still race on the unique ``email`` / ``display_id`` columns; the
    row-conflict path surfaces as ``IntegrityError`` and is treated as a
    retry-worthy error by the caller (see §4.5 of the 6+7 design spec).
    """
    email = email.lower()
    existing = await session.get(UserRow, auth_user_id)
    if existing is not None:
        return existing
    display_id = await generate_user_display_id(session, email=email)
    row = UserRow(
        id=auth_user_id,
        display_id=display_id,
        email=email,
        profile_complete=False,
    )
    session.add(row)
    await session.flush()
    return row


def derive_user_name(row: UserRow) -> str:
    """Display name fallback chain: zh_name → nickname → email local-part."""
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
        name=derive_user_name(row),
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

- [ ] **Step 4: Update `backend/src/backend/db/models.py`**

Change line 30 (the `UserRow.id` field) from:

```python
    id: UUID = Field(default_factory=uuid4, primary_key=True)
```

to:

```python
    id: UUID = Field(primary_key=True)
```

(Remove `default_factory=uuid4`. Other tables — `TeamRow`, `JoinRequestRow`, etc. — keep their `uuid4` defaults; they're app-owned entities.)

- [ ] **Step 5: Run — expect PASS on user service tests**

```bash
(cd backend && uv run pytest tests/services/test_user_service.py -v)
```

Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/backend/services/user.py backend/src/backend/db/models.py backend/tests/services/test_user_service.py
git commit -m "feat(services): upsert UserRow by Supabase identity (Phase 6a)"
```

### Task D2: Rewire `current_user`

**Files:**
- Modify: `backend/src/backend/auth/dependencies.py`
- Modify: `backend/tests/routers/test_auth_required.py`

- [ ] **Step 1: Write the failing test in `backend/tests/routers/test_auth_required.py`**

Replace the existing file contents with:

```python
"""401 handling + upsert-on-first-auth coverage for current_user."""

from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_protected_route_rejects_missing_bearer(client: AsyncClient) -> None:
    r = await client.get("/api/v1/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_rejects_malformed_bearer(client: AsyncClient) -> None:
    r = await client.get("/api/v1/me", headers={"Authorization": "Basic abc"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_rejects_invalid_jwt(client: AsyncClient) -> None:
    r = await client.get("/api/v1/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_current_user_upserts_fresh_signup(
    client: AsyncClient,
    session: AsyncSession,
    mint_access_token,
) -> None:
    """First authed request for a never-seen sub creates the UserRow."""
    from backend.db.models import UserRow

    auth_id = UUID(int=9999)
    token = mint_access_token(user_id=auth_id, email="fresh@example.com")

    r = await client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text

    # UserRow now exists keyed by the Supabase sub.
    row = await session.get(UserRow, auth_id)
    assert row is not None
    assert row.email == "fresh@example.com"
    assert row.profile_complete is False


@pytest.mark.asyncio
async def test_current_user_is_idempotent_across_requests(
    client: AsyncClient,
    mint_access_token,
) -> None:
    auth_id = UUID(int=9998)
    token = mint_access_token(user_id=auth_id, email="repeat@example.com")

    r1 = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    r2 = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["id"] == r2.json()["id"]
    assert r1.json()["display_id"] == r2.json()["display_id"]
```

- [ ] **Step 2: Run — expect FAIL (current_user still looks up HS256)**

```bash
(cd backend && uv run pytest tests/routers/test_auth_required.py -v)
```

Expected: FAIL — the HS256 path can't verify our RS256-signed token.

- [ ] **Step 3: Rewrite `backend/src/backend/auth/dependencies.py`**

```python
"""FastAPI dependency that resolves the current UserRow from a Bearer
token. Raises 401 on missing, malformed, expired, or JWKS-mismatched
tokens. On first authed request for a never-seen Supabase ``sub``, the
matching ``UserRow`` is upserted so downstream routes always have an
app-side row to work against.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.supabase import verify_supabase_jwt
from backend.db.models import UserRow
from backend.db.session import get_session
from backend.services.user import upsert_user_by_supabase_identity

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
        claims = verify_supabase_jwt(token)
    except ValueError as exc:
        raise _UNAUTHORIZED from exc

    user = await session.get(UserRow, claims.sub)
    if user is None:
        user = await upsert_user_by_supabase_identity(
            session,
            auth_user_id=claims.sub,
            email=str(claims.email),
        )
        await session.commit()
    return user
```

- [ ] **Step 4: Run — expect PASS**

```bash
(cd backend && uv run pytest tests/routers/test_auth_required.py -v)
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/auth/dependencies.py backend/tests/routers/test_auth_required.py
git commit -m "feat(auth): current_user verifies Supabase JWTs + upserts on first sight (Phase 6a)"
```

### Task D3: Delete legacy auth surface

**Files:**
- Delete: `backend/src/backend/auth/google_stub.py`
- Delete: `backend/src/backend/auth/jwt.py`
- Delete: `backend/src/backend/routers/auth.py`
- Delete: `backend/tests/auth/test_jwt.py`
- Delete: `backend/tests/auth/test_google_stub.py`
- Delete: `backend/tests/routers/test_auth.py`
- Modify: `backend/src/backend/server.py` — remove `auth` import + `include_router(auth.router)` line
- Modify: `backend/tests/test_config.py` — drop `JWT_SECRET`-referencing tests

- [ ] **Step 1: Delete the files**

```bash
rm backend/src/backend/auth/google_stub.py
rm backend/src/backend/auth/jwt.py
rm backend/src/backend/routers/auth.py
rm backend/tests/auth/test_jwt.py
rm backend/tests/auth/test_google_stub.py
rm backend/tests/routers/test_auth.py
```

- [ ] **Step 2: Update `backend/src/backend/server.py`**

Remove `auth` from the import line:

```python
from backend.routers import health, leaderboard, me, news, tasks, teams
```

Remove this line from `create_app()`:

```python
app.include_router(auth.router, prefix=API_V1)
```

- [ ] **Step 3: Update `backend/tests/test_config.py`**

Delete any tests that reference `JWT_SECRET` or `jwt_secret`. Keep (or add) the two Supabase-oriented tests from Task A1. Full file after the sweep:

```python
"""Settings env parsing + prod-env guard."""

import pytest

from backend.config import get_settings


def test_settings_parses_cors_origins_comma_separated(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://a.com, https://b.com")
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.cors_origins == ["https://a.com", "https://b.com"]


def test_settings_parses_cors_origins_json_array(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", '["https://a.com","https://b.com"]')
    get_settings.cache_clear()
    settings = get_settings()
    # JSON-array form is parsed by pydantic-settings' default list parser;
    # comma parsing is our custom validator's responsibility.
    assert "https://a.com" in settings.cors_origins
    assert "https://b.com" in settings.cors_origins


def test_settings_requires_supabase_url_in_prod(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        get_settings()


def test_settings_derives_jwks_url_from_supabase_url(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.supabase_jwks_url == "https://abc.supabase.co/auth/v1/.well-known/jwks.json"
    assert settings.supabase_issuer == "https://abc.supabase.co/auth/v1"
    assert settings.supabase_jwt_aud == "authenticated"


def test_settings_accepts_app_env_test(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()
    assert get_settings().app_env == "test"
```

- [ ] **Step 4: Update `backend/tests/conftest.py`**

Remove the `TEST_JWT_SECRET` constant and the `JWT_SECRET` monkeypatching block in the `engine` fixture. The updated `engine` fixture body (keep everything else):

```python
@pytest_asyncio.fixture(scope="session")
async def engine(
    postgres_container: PostgresContainer,
) -> AsyncIterator[AsyncEngine]:
    url = postgres_container.get_connection_url()

    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("DATABASE_URL", url)
        mp.setenv("APP_ENV", "test")
        mp.setenv("SUPABASE_URL", SUPABASE_TEST_URL)
        get_settings.cache_clear()
        get_engine.cache_clear()
        get_session_maker.cache_clear()

        def _upgrade() -> None:
            from alembic.config import Config
            from alembic import command

            cfg = Config(str(_BACKEND_DIR / "alembic.ini"))
            cfg.set_main_option("script_location", str(_BACKEND_DIR / "alembic"))
            command.upgrade(cfg, "head")

        await asyncio.to_thread(_upgrade)

        eng = get_engine()
        try:
            yield eng
        finally:
            await eng.dispose()
            get_engine.cache_clear()
            get_session_maker.cache_clear()
```

Also delete the unused `import os` line if it was only supporting the `JWT_SECRET` block.

- [ ] **Step 5: Run — verify nothing silently imports the deleted modules**

```bash
(cd backend && uv run pytest tests/ -x 2>&1 | tail -40)
```

Expected: either full pass OR failures confined to `tests/routers/test_*` that still use `helpers.sign_in` (POSTing to the now-deleted `/auth/google`). Those are fixed in Section E.

- [ ] **Step 6: Commit**

```bash
git add -A backend/src/backend/auth/ backend/src/backend/routers/ backend/src/backend/server.py \
        backend/tests/auth/ backend/tests/routers/test_auth.py backend/tests/test_config.py \
        backend/tests/conftest.py
git commit -m "refactor(auth): delete HS256 + email-stub auth surface (Phase 6a)"
```

---

## Section E — Integration test helpers + sweep

**Exit criteria:** `tests/helpers.py::sign_in` mints a JWT directly; every `tests/routers/test_*.py` passes; `just -f backend/justfile ci` is green.

### Task E1: Rewrite `sign_in` helper to mint tokens

**Files:**
- Modify: `backend/tests/helpers.py`

- [ ] **Step 1: Rewrite `backend/tests/helpers.py`**

Full file:

```python
"""Shared test helpers.

Keep small. Anything reusable across 3+ test modules lives here.

Phase 6a: ``sign_in`` no longer hits an endpoint — it mints a
Supabase-shaped RS256 JWT via the ``mint_access_token`` fixture and
issues a single GET /me so the UserRow is materialized with the
correct Supabase sub.
"""

from collections.abc import Callable
from typing import NamedTuple
from uuid import UUID, uuid4

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


async def sign_in(
    client: AsyncClient,
    email: str,
    *,
    mint_access_token: Callable[..., str],
    user_id: UUID | None = None,
) -> dict[str, str]:
    """Sign in via minted JWT. Returns bearer-auth headers.

    ``user_id`` defaults to a fresh ``uuid4()``; pass an explicit UUID when
    the test needs a stable identity across calls (e.g., to assert a row
    persists between requests).
    """
    token = mint_access_token(user_id=user_id or uuid4(), email=email)
    headers = {"Authorization": f"Bearer {token}"}
    # Prime the upsert so the UserRow exists before the caller exercises
    # anything non-idempotent (e.g., POST /me/profile).
    r = await client.get("/api/v1/me", headers=headers)
    assert r.status_code == 200, r.text
    return headers


async def sign_in_and_complete(
    client: AsyncClient,
    email: str,
    *,
    mint_access_token: Callable[..., str],
    zh_name: str = "X",
) -> SignedInUser:
    """Sign in + complete profile (auto-creates led team). Returns
    headers, user_id, and the auto-created led_team_id.
    """
    headers = await sign_in(client, email, mint_access_token=mint_access_token)
    body = {**_BASE_PROFILE, "zh_name": zh_name}
    response = await client.post("/api/v1/me/profile", json=body, headers=headers)
    assert response.status_code == 200, response.text
    payload = response.json()
    return SignedInUser(
        headers=headers,
        user_id=UUID(payload["user"]["id"]),
        led_team_id=UUID(payload["led_team"]["id"]),
    )
```

- [ ] **Step 2: Run — expect failures in tests that still call the old helper signature**

```bash
(cd backend && uv run pytest tests/routers/ -x 2>&1 | tail -20)
```

Expected: FAIL — tests call `sign_in(client, email)` without the new `mint_access_token` kwarg.

### Task E2: Migrate all router + service tests to the new helper

**Files:**
- Modify: `backend/tests/routers/test_me.py`
- Modify: `backend/tests/routers/test_me_profile.py`
- Modify: `backend/tests/routers/test_me_teams.py`
- Modify: `backend/tests/routers/test_leaderboard.py`
- Modify: `backend/tests/routers/test_news.py`
- Modify: `backend/tests/routers/test_tasks_read.py`
- Modify: `backend/tests/routers/test_tasks_submit.py`
- Modify: `backend/tests/routers/test_teams_approve_reject.py`
- Modify: `backend/tests/routers/test_teams_join_requests.py`
- Modify: `backend/tests/routers/test_teams_leave.py`
- Modify: `backend/tests/routers/test_teams_read.py`
- Modify: `backend/tests/routers/test_teams_update.py`
- Modify: `backend/tests/routers/test_rewards_read.py`

- [ ] **Step 1: Mechanical sweep — thread `mint_access_token` into every helper call**

For every test function in the files above that currently reads like:

```python
async def test_something(client, ...):
    headers = await sign_in(client, "jet@example.com")
    ...
```

Change the signature + call site to:

```python
async def test_something(client, mint_access_token, ...):
    headers = await sign_in(client, "jet@example.com", mint_access_token=mint_access_token)
    ...
```

Same pattern for `sign_in_and_complete`: add `mint_access_token` as a fixture parameter and pass it as a keyword.

Run this grep to find every call site:

```bash
(cd backend && grep -rn 'await sign_in\|await sign_in_and_complete' tests/)
```

Touch each one. If a single test uses three personas (e.g., leader + joiner + outsider), all three get the same `mint_access_token` fixture once — calling it multiple times with different `email` values yields distinct tokens sharing one keypair.

- [ ] **Step 2: Run — expect PASS**

```bash
(cd backend && uv run pytest tests/routers/ -v 2>&1 | tail -30)
```

Expected: all router tests green. Services are untouched.

- [ ] **Step 3: Run the full suite**

```bash
(cd backend && uv run pytest tests/ 2>&1 | tail -10)
```

Expected: full pass.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/helpers.py backend/tests/routers/
git commit -m "test(backend): mint Supabase JWTs in integration helpers (Phase 6a)"
```

---

## Section F — Seed update + final sweep

**Exit criteria:** `just -f backend/justfile seed` idempotently populates DEMO_USERS with stable UUIDs. `just -f backend/justfile ci` green end-to-end.

### Task F1: Seed DEMO_USERS with stable UUIDs

**Files:**
- Modify: `backend/src/backend/seed.py`
- Modify: `backend/tests/test_seed_demo.py`

- [ ] **Step 1: Read the current DEMO_USERS block in `backend/src/backend/seed.py`**

(Lines 33–94 are the six-user list; leave names/emails intact; you'll add a `user_id` per entry.)

- [ ] **Step 2: Update `DEMO_USERS` to carry stable UUIDs and call the new upsert function**

Replace the `DEMO_USERS` list + any `upsert_user_by_email` call with:

```python
from uuid import UUID

from backend.services.user import upsert_user_by_supabase_identity

DEMO_USERS: list[dict[str, str | UUID]] = [
    {
        "user_id": UUID(int=1),
        "email": "jet@demo.ga",
        "zh_name": "金杰",
        "en_name": "Jet Kan",
        "nickname": "Jet",
        "phone": "912345678",
        "phone_code": "+886",
        "country": "TW",
        "location": "台北",
    },
    {
        "user_id": UUID(int=2),
        "email": "ami@demo.ga",
        "zh_name": "林詠瑜",
        "en_name": "Ami Lin",
        "nickname": "Ami",
        "phone": "912345679",
        "phone_code": "+886",
        "country": "TW",
        "location": "台北",
    },
    {
        "user_id": UUID(int=3),
        "email": "alex@demo.ga",
        "zh_name": "陳志豪",
        "en_name": "Alex Chen",
        "nickname": "Alex",
        "phone": "912345680",
        "phone_code": "+886",
        "country": "TW",
        "location": "新北",
    },
    {
        "user_id": UUID(int=4),
        "email": "mei@demo.ga",
        "zh_name": "王美玲",
        "en_name": "Mei Wang",
        "nickname": "Mei",
        "phone": "912345681",
        "phone_code": "+886",
        "country": "TW",
        "location": "台中",
    },
    {
        "user_id": UUID(int=5),
        "email": "kai@demo.ga",
        "zh_name": "黃凱文",
        "en_name": "Kai Huang",
        "nickname": "Kai",
        "phone": "912345682",
        "phone_code": "+886",
        "country": "TW",
        "location": "高雄",
    },
    {
        "user_id": UUID(int=6),
        "email": "yu@demo.ga",
        "zh_name": "張詩宇",
        "en_name": "Yu Chang",
        "nickname": "Yu",
        "phone": "912345683",
        "phone_code": "+886",
        "country": "TW",
        "location": "台南",
    },
]
```

Find every existing call that passes a DEMO_USER entry to `upsert_user_by_email(session, email=entry["email"])` and replace with:

```python
row = await upsert_user_by_supabase_identity(
    session,
    auth_user_id=entry["user_id"],
    email=entry["email"],
)
```

Update the import at the top:

```python
# Replace:
from backend.services.user import upsert_user_by_email
# With:
from backend.services.user import upsert_user_by_supabase_identity
```

- [ ] **Step 3: Update `backend/tests/test_seed_demo.py`**

Any assertion that reads a user by email only still works — but add one assertion that demo seed uses the documented stable UUID:

```python
from uuid import UUID
# ... inside a test that runs the seed ...
row = await session.get(UserRow, UUID(int=1))
assert row is not None
assert row.email == "jet@demo.ga"
```

- [ ] **Step 4: Run — expect PASS**

```bash
(cd backend && uv run pytest tests/test_seed_demo.py tests/test_seed.py -v)
```

Expected: all seed tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/backend/seed.py backend/tests/test_seed_demo.py
git commit -m "refactor(seed): DEMO_USERS with stable UUIDs for Supabase identity (Phase 6a)"
```

### Task F2: Full CI

**Files:** none (verification only)

- [ ] **Step 1: Run the CI recipe**

```bash
just -f backend/justfile ci
```

Expected: lint clean, format clean, typecheck clean, contract fixtures validate, pytest green at ≥90% coverage.

- [ ] **Step 2: If any ruff auto-fix drift, stage and amend the most recent commit**

```bash
git diff --stat
# If diff is clean → done. If ruff rewrote anything:
git add -A
git commit --amend --no-edit
```

- [ ] **Step 3: Verify no stale imports of deleted modules**

```bash
grep -rn 'google_stub\|encode_token\|decode_token\|upsert_user_by_email\|auth.jwt\|routers.auth\b' backend/src backend/tests
```

Expected: zero matches.

- [ ] **Step 4: Verify exit criteria**

```bash
grep -rn 'JWT_SECRET' backend/src backend/tests || echo "clean"
grep -rn '/auth/google\|/auth/logout' backend/src || echo "clean"
```

Expected: both print `clean`.

---

## Final self-check before handoff to 6b

- [ ] `current_user` verifies RS256 Supabase-shaped tokens.
- [ ] First auth'd request for a never-seen `sub` materializes a `UserRow` with `profile_complete=False`.
- [ ] `backend/src/backend/auth/` contains only `__init__.py`, `dependencies.py`, `supabase.py`.
- [ ] `backend/src/backend/routers/` no longer contains `auth.py`.
- [ ] `just -f backend/justfile ci` green.
- [ ] `backend/.env.example` + `backend/src/backend/config.py` reflect the Supabase env vars.
- [ ] Seed + helpers ported; every integration test uses `mint_access_token`.

Once this plan is merged, the backend is ready to accept real Supabase JWTs. The frontend migration (plan 6b) is the next step and can be started as soon as 6a is on `main`.
