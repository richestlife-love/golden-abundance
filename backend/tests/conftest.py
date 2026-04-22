"""Shared pytest fixtures.

A single Postgres container is started for the whole test session
(via testcontainers) and Alembic migrations are applied against it
before any test runs — plain ``SQLModel.metadata.create_all`` would
silently paper over drift between ``db/models.py`` and the migration
files. Each test gets an AsyncSession off the shared sessionmaker;
after the test, every table is TRUNCATE'd so the next one starts
clean.
"""

import asyncio
import pathlib
import time
from collections.abc import AsyncIterator, Callable, Iterator
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlmodel import SQLModel
from testcontainers.postgres import PostgresContainer

from backend.config import get_settings
from backend.db import models as _models  # noqa: F401 — populates metadata
from backend.db.engine import get_engine, get_session_maker
from backend.db.models import TaskDefRequiresRow, TaskDefRow, TaskStepDefRow
from backend.db.session import get_session
from backend.seed import PROTOTYPE_TASK_DEFS
from backend.server import create_app

_BACKEND_DIR = pathlib.Path(__file__).parent.parent

POSTGRES_IMAGE = "postgres:17-alpine"

SUPABASE_TEST_URL = "https://test-ref.supabase.co"
SUPABASE_TEST_AUD = "authenticated"
SUPABASE_TEST_ISS = f"{SUPABASE_TEST_URL}/auth/v1"
SUPABASE_TEST_KID = "test-kid-2026"


@pytest.fixture(autouse=True)
def _reset_settings_cache() -> Iterator[None]:
    """Bracket every test with a fresh ``get_settings()`` cache.

    Tests that mutate env via ``monkeypatch.setenv`` rely on
    ``get_settings()`` re-reading the environment on its next call.
    Centralising the reset here removes the need to sprinkle
    ``get_settings.cache_clear()`` around individual tests.
    """
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(scope="session")
def postgres_container() -> Iterator[PostgresContainer]:
    with PostgresContainer(POSTGRES_IMAGE, driver="psycopg") as pg:
        yield pg


@pytest_asyncio.fixture(scope="session")
async def engine(
    postgres_container: PostgresContainer,
) -> AsyncIterator[AsyncEngine]:
    url = postgres_container.get_connection_url()

    with pytest.MonkeyPatch.context() as mp:
        mp.setenv("DATABASE_URL", url)
        mp.setenv("APP_ENV", "test")
        mp.setenv("SUPABASE_URL", SUPABASE_TEST_URL)
        # Rate limiting is enabled in prod but would flap tests that
        # hit the same endpoint many times (e.g., idempotent loops).
        # The dedicated test_rate_limit.py module opts back in.
        mp.setenv("RATE_LIMIT_DISABLED", "1")
        get_settings.cache_clear()
        get_engine.cache_clear()
        get_session_maker.cache_clear()

        # alembic.command.upgrade is sync and spins its own event loop via
        # asyncio.run() in env.py — off-thread it so we don't deadlock.
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


@pytest.fixture
def no_db_client() -> Iterator[TestClient]:
    """Sync TestClient without DB — for routes that don't touch the database."""
    with TestClient(create_app()) as c:
        yield c


@pytest_asyncio.fixture
async def session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with get_session_maker()() as s:
        yield s
    # TRUNCATE every table in a single round-trip. CASCADE makes ordering
    # irrelevant, so we skip the reverse-sorted-tables dance.
    tables = ", ".join(f'"{t.name}"' for t in SQLModel.metadata.sorted_tables)
    if tables:
        async with engine.begin() as conn:
            await conn.execute(text(f"TRUNCATE TABLE {tables} CASCADE"))


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    app = create_app()

    async def _override_get_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = _override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def seeded_task_defs(session: AsyncSession) -> dict[str, TaskDefRow]:
    """Seed the four prototype tasks (T1 interest form, T2 ticket form,
    T3 team challenge, T4 expired training) off the shared
    ``backend.seed.PROTOTYPE_TASK_DEFS`` so the fixture stays in sync
    with the real seed. Returns a dict keyed by display_id.
    """
    defs = {did: TaskDefRow(display_id=did, **fields) for did, fields in PROTOTYPE_TASK_DEFS.items()}
    for t in defs.values():
        session.add(t)
    await session.flush()

    # One T1 step is enough for the step-derivation tests; the full
    # 4-step list lives in the seed script for the dev fixture.
    session.add(TaskStepDefRow(task_def_id=defs["T1"].id, label="確認電子郵件與手機", order=1))
    session.add(TaskDefRequiresRow(task_def_id=defs["T2"].id, requires_id=defs["T1"].id))
    await session.commit()

    return defs


# -------------------------------------------------------------------
# Phase 6a fixtures: RSA keypair + Supabase-shaped JWT minter
# -------------------------------------------------------------------


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
    public_pem = (
        key.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    return private_pem, public_pem


@pytest.fixture
def mint_access_token(rsa_test_keypair: tuple[str, str]) -> Callable[..., str]:
    """Mint an RS256-signed JWT mimicking Supabase's claim shape.

    Call as ``mint_access_token(user_id=UUID(...), email="e@x.com")``.
    Optional keyword overrides (``exp``, ``iat``, ``aud``, ``iss``, ``kid``)
    let tests forge expired / mis-issued tokens for negative-path coverage.
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
def _bind_sign_in_mint(mint_access_token: Callable[..., str]) -> Iterator[None]:
    """Inject ``mint_access_token`` into ``tests.helpers`` for the test.

    ``sign_in`` / ``sign_in_and_complete`` read from a module-level slot
    instead of receiving the mint fn as a kwarg on every call site; this
    fixture populates and clears that slot per-test. Autouse because
    every router integration test uses the helpers, and a missed import
    would otherwise surface as a cryptic RuntimeError mid-test.
    """
    from tests import helpers

    helpers._MINT_FN = mint_access_token
    try:
        yield
    finally:
        helpers._MINT_FN = None


@pytest.fixture(autouse=True)
def stub_jwks(
    rsa_test_keypair: tuple[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Route Supabase JWKS lookups to the session's test public key.

    Applied autouse because every integration test that mints a token
    needs it; opting out is as simple as not minting a token. The
    stubbed client returns an object with the expected ``.key``
    attribute on ``get_signing_key_from_jwt`` so PyJWT's verifier can
    proceed without a real network fetch.

    No explicit teardown: ``monkeypatch`` is function-scoped and
    automatically undoes both ``setenv`` and ``setattr`` after the test.
    """
    _private_pem, public_pem = rsa_test_keypair

    monkeypatch.setenv("SUPABASE_URL", SUPABASE_TEST_URL)
    # Defensive: `_reset_settings_cache` (autouse, defined earlier in this
    # file) also clears the cache around every test. Pytest fixture ordering
    # between sibling autouse fixtures is undefined, so we clear again here
    # after setenv to guarantee the next `get_settings()` call re-reads env.
    get_settings.cache_clear()

    pub_key = serialization.load_pem_public_key(public_pem.encode())

    class _StubJWKClient:
        def get_signing_key_from_jwt(self, _token: str) -> object:
            class _Key:
                key = pub_key

            return _Key()

    monkeypatch.setattr(
        "backend.auth.supabase._jwks_client",
        lambda: _StubJWKClient(),
    )
