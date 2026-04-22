"""Observability hooks — Sentry request-body scrubbing + structured logs.

PII policy: we strip request bodies from Sentry events on endpoints
that accept personal data (phone, social IDs). ``send_default_pii=False``
at init time already suppresses cookies / IP / headers, but the FastAPI
integration can still attach the JSON body to an event if an exception
fires mid-handler. The scrub hook below is a defensive before_send that
drops the body on any path matching a sensitive-endpoint pattern.

Structured logging emits JSON on stdout. Every request gets one log
line with method, path, status, and duration; any handler that needs
richer context can call
``logging.getLogger(...).info(..., extra={...})`` and those extras
land in the JSON payload.
"""

import json
import logging
import re
import time
from collections.abc import Awaitable, Callable
from typing import Any
from urllib.parse import urlparse

from sentry_sdk.types import Event, Hint
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Paths whose request body contains PII or user-supplied free text.
# Extend this list when new mutating endpoints accept personal fields.
_SENSITIVE_PATH_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^/api/v1/me/profile(?:/|$)"),
    re.compile(r"^/api/v1/tasks/[^/]+/submit(?:/|$)"),
)

# Keys whose values are lifted from ``record.__dict__`` into the JSON
# payload — loggers that want structured context call
# ``logger.info("msg", extra={"user_id": ...})``.
_STRUCTURED_EXTRAS: tuple[str, ...] = (
    "method",
    "path",
    "status",
    "duration_ms",
    "user_id",
    "event",
)

# Log noise suppression. uvicorn.access is silenced in favour of the
# RequestLogMiddleware below, which has per-request user context the
# uvicorn default line can't provide.
_SILENCED_LOGGERS: tuple[str, ...] = ("uvicorn.access",)


def scrub_sensitive_bodies(event: Event, _hint: Hint) -> Event | None:
    request = event.get("request")
    if not isinstance(request, dict):
        return event
    path = _path_from_request(request)
    if any(p.search(path) for p in _SENSITIVE_PATH_PATTERNS):
        request.pop("data", None)
        request.pop("json_body", None)
    return event


def _path_from_request(request: dict[str, Any]) -> str:
    url = request.get("url", "")
    try:
        return urlparse(url).path or url
    except ValueError:
        return url


class JsonFormatter(logging.Formatter):
    """Minimal JSON formatter for stdlib logging.

    Emits ``ts``, ``level``, ``logger``, ``msg`` for every record, plus
    any keys in ``_STRUCTURED_EXTRAS`` that the caller passed via
    ``extra={...}``. Exception info is serialised as a string under
    ``exc`` so it doesn't break the JSON shape.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key in _STRUCTURED_EXTRAS:
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging() -> None:
    """Attach a JSON StreamHandler to the root logger (idempotent).

    Called once from ``create_app``. Subsequent calls are no-ops — the
    handler check prevents double-attaching when ``create_app`` is
    called multiple times (per-test client construction).
    """
    root = logging.getLogger()
    if any(isinstance(h.formatter, JsonFormatter) for h in root.handlers):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    if root.level == logging.WARNING:  # stdlib default
        root.setLevel(logging.INFO)
    for name in _SILENCED_LOGGERS:
        logging.getLogger(name).propagate = False


class RequestLogMiddleware(BaseHTTPMiddleware):
    """Emit one structured log line per request.

    The line includes method, path, status code, and wall-clock
    duration_ms. Upstream handlers that want to attach ``user_id`` can
    set ``request.state.user_id`` and this middleware forwards it.
    """

    _logger = logging.getLogger("backend.request")

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - started) * 1000)
        extra: dict[str, Any] = {
            "event": "request",
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
        }
        user_id = getattr(request.state, "user_id", None)
        if user_id is not None:
            extra["user_id"] = str(user_id)
        self._logger.info("%s %s %s", request.method, request.url.path, response.status_code, extra=extra)
        return response
