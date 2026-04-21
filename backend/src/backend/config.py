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

from pydantic import Field, field_validator
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
