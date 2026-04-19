"""Runtime settings loaded from environment variables.

`Settings` is a pydantic-settings model; `get_settings()` returns a
process-wide cached instance so FastAPI deps can depend on it without
re-reading the environment on every call.

Boot safety: ``get_settings()`` refuses to return a production-env
instance still using the baked-in dev ``JWT_SECRET`` — a deploy that
forgets to set ``JWT_SECRET`` fails fast at app import rather than
silently issuing tokens signed with a public secret.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_JWT_SECRET = "dev-only-change-me-please-in-prod"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(
        default="postgresql+psycopg://app:app@localhost:5432/app",
        description="SQLAlchemy URL (psycopg3 driver).",
    )
    jwt_secret: str = Field(default=_DEV_JWT_SECRET, min_length=32)
    jwt_ttl_seconds: int = Field(default=86400, ge=60)
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://localhost:8000"])

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v: object) -> object:
        """Accept either JSON array or comma-separated env-var form."""
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    app_env: Literal["dev", "test", "prod"] = "dev"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    if settings.app_env == "prod" and settings.jwt_secret == _DEV_JWT_SECRET:
        raise RuntimeError("JWT_SECRET must be set to a non-default value when APP_ENV=prod")
    return settings
