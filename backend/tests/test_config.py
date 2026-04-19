"""Tests for backend.config — the `Settings` class and its safeguards."""

import pytest
from pydantic import ValidationError

from backend.config import Settings, get_settings


def test_prod_with_default_secret_refuses_to_load(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("JWT_SECRET", Settings.model_fields["jwt_secret"].default)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        get_settings()


def test_prod_with_real_secret_loads(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("JWT_SECRET", "a-real-long-secret-from-a-vault-32-plus")
    assert get_settings().app_env == "prod"


def test_short_secret_rejected_by_pydantic(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "short")
    with pytest.raises(ValidationError):
        Settings()


def test_cors_origins_parses_comma_separated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://a.example,http://b.example")
    assert get_settings().cors_origins == ["http://a.example", "http://b.example"]
