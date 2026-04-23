"""Unauthenticated health probes. Not under /api/v1 — deployment
load balancers hit these at the root.

``/health`` is pure liveness (the process is up). ``/readyz`` is
readiness — it pings the DB pool on every call, so a broken DB
connection takes the pod out of rotation instead of silently serving
500s on real requests.
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from backend.db.engine import get_engine

router = APIRouter()


@router.get("/health", tags=["internal"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz", tags=["internal"])
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
