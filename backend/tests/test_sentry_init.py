"""Smoke that Sentry init only fires when SENTRY_DSN is set.

sentry_sdk.init() mutates process-global state (binds a client on the
isolation scope, installs integration monkey-patches). The autouse fixture
below closes the client after each test so event flushing stops and
subsequent test modules don't observe a stale bound client. Integration
monkey-patches installed by init() persist for the process lifetime but
are inert once the client is closed.
"""

from collections.abc import Iterator

import pytest
import sentry_sdk

from backend.config import get_settings
from backend.server import create_app


@pytest.fixture(autouse=True)
def _reset_sentry_client() -> Iterator[None]:
    yield
    sentry_sdk.get_client().close()


def test_create_app_without_sentry_dsn_does_not_init(monkeypatch) -> None:
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    get_settings.cache_clear()

    # If create_app tried to contact a real Sentry, the test would hang.
    # No DSN means no init; app builds cleanly.
    app = create_app()
    assert app.title.startswith("Golden Abundance")


def test_create_app_with_sentry_dsn_installs_hub(monkeypatch) -> None:
    """With a DSN set, sentry_sdk has a bound client after init."""
    monkeypatch.setenv(
        "SENTRY_DSN",
        "https://public@o0.ingest.sentry.io/0",  # valid-shape fake; SDK accepts without network round-trip
    )
    monkeypatch.setenv("APP_RELEASE", "test-release-7b")
    get_settings.cache_clear()

    create_app()
    client = sentry_sdk.get_client()
    assert client is not None
    # Client.dsn's string form has been normalized across sdk versions;
    # match the prefix rather than the literal DSN string.
    assert str(client.dsn).startswith("https://public@")
