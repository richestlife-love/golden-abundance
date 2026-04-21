"""Settings env parsing + prod-env guard."""

import pytest

from backend.config import get_settings


def test_settings_parses_cors_origins_comma_separated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://a.com, https://b.com")
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.cors_origins == ["https://a.com", "https://b.com"]


def test_settings_requires_supabase_url_in_prod(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        get_settings()


def test_settings_derives_jwks_url_from_supabase_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.supabase_jwks_url == "https://abc.supabase.co/auth/v1/.well-known/jwks.json"
    assert settings.supabase_issuer == "https://abc.supabase.co/auth/v1"
    assert settings.supabase_jwt_aud == "authenticated"


def test_settings_accepts_app_env_test(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()
    assert get_settings().app_env == "test"
