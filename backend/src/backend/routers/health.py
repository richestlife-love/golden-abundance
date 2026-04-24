"""Unauthenticated health probes. Not under /api/v1 — deployment
load balancers hit these at the root.

``/health`` is pure liveness (the process is up). ``/readyz`` is
readiness — it pings the DB pool on every call, so a broken DB
connection takes the pod out of rotation instead of silently serving
500s on real requests.
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from backend.config import get_settings
from backend.db.engine import get_engine

router = APIRouter()


@router.api_route("/health", methods=["GET", "HEAD"], tags=["internal"], include_in_schema=False)
async def health() -> dict[str, str | None]:
    return {"status": "ok", "release": get_settings().app_release}


@router.api_route("/readyz", methods=["GET", "HEAD"], tags=["internal"], include_in_schema=False)
async def readyz() -> dict[str, str]:
    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database unavailable",
        ) from exc
    return {"status": "ready"}
