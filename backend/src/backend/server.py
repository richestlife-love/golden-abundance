"""FastAPI application factory.

`create_app()` builds and returns a fully-wired FastAPI instance.
A module-level `app` is exported for `fastapi-cli` (see
`[tool.fastapi] entrypoint` in pyproject.toml).
"""

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import get_settings
from backend.observability import scrub_sensitive_bodies
from backend.routers import health, leaderboard, me, news, tasks, teams
from backend.services.pagination import InvalidCursorError

API_V1 = "/api/v1"


def create_app() -> FastAPI:
    settings = get_settings()
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.app_env,
            release=settings.app_release,
            traces_sample_rate=0.1,
            profiles_sample_rate=0.0,
            send_default_pii=False,
            before_send=scrub_sensitive_bodies,
        )

    app = FastAPI(
        title="Golden Abundance API",
        version="0.1.0",
        description="Phase 7 backend — see backend/src/backend/contract/endpoints.md",
    )
    # Auth is `Authorization: Bearer` only — no cookies — so
    # allow_credentials stays False. Methods and headers are enumerated
    # rather than wildcarded so a misconfigured frontend fails loudly
    # instead of silently gaining extra surface.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=600,
    )
    app.include_router(health.router)
    app.include_router(me.router, prefix=API_V1)
    app.include_router(news.router, prefix=API_V1)
    app.include_router(leaderboard.router, prefix=API_V1)
    app.include_router(tasks.router, prefix=API_V1)
    app.include_router(teams.router, prefix=API_V1)

    async def _invalid_cursor_handler(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc) or "Invalid cursor"})

    app.add_exception_handler(InvalidCursorError, _invalid_cursor_handler)
    return app


app = create_app()
