"""Observability hooks — Sentry request-body scrubbing + access logging.

PII policy: we strip request bodies from Sentry events on endpoints
that accept personal data (phone, social IDs). ``send_default_pii=False``
at init time already suppresses cookies / IP / headers, but the FastAPI
integration can still attach the JSON body to an event if an exception
fires mid-handler. The scrub hook below is a defensive before_send that
drops the body on any path matching a sensitive-endpoint pattern.

Logging emits one human-readable line per request on stdout with method,
path, status, duration, and (when available) user_id. Railway's log
viewer displays these directly; if a JSON-parsing log drain is added
later, swap the formatter here.
"""

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

# Loggers whose records should not bubble up to the root handler.
#   ``uvicorn.access`` — replaced by RequestLogMiddleware, which carries
#     per-request user_id / duration the uvicorn default line can't.
#   ``uvicorn`` — uvicorn owns its own pretty-formatted output via its
#     own handler; without this, lifecycle lines (startup / shutdown /
#     500s) would be re-emitted a second time by our root handler.
_SILENCED_LOGGERS: tuple[str, ...] = ("uvicorn.access", "uvicorn")

# Named so configure_logging can detect a prior install without relying
# on formatter identity.
_ROOT_HANDLER_NAME = "backend.root"


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


def configure_logging() -> None:
    """Attach a plain StreamHandler to the root logger (idempotent).

    Called once from ``create_app``. Subsequent calls are no-ops — the
    named-handler check prevents double-attaching when ``create_app``
    is called multiple times (per-test client construction).
    """
    root = logging.getLogger()
    if any(getattr(h, "name", None) == _ROOT_HANDLER_NAME for h in root.handlers):
        return
    handler = logging.StreamHandler()
    handler.name = _ROOT_HANDLER_NAME
    handler.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
    root.addHandler(handler)
    if root.level == logging.WARNING:  # stdlib default
        root.setLevel(logging.INFO)
    for name in _SILENCED_LOGGERS:
        logging.getLogger(name).propagate = False


class RequestLogMiddleware(BaseHTTPMiddleware):
    """Emit one access-log line per request.

    The line includes method, path, status code, wall-clock duration,
    and (if the handler set ``request.state.user_id``) the user id.
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
        user_id = getattr(request.state, "user_id", None)
        user_part = f" user={user_id}" if user_id is not None else ""
        self._logger.info(
            "%s %s %d %dms%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            user_part,
        )
        return response
