"""Observability hooks — currently: Sentry request-body scrubbing.

PII policy: we strip request bodies from Sentry events on endpoints
that accept personal data (phone, social IDs). ``send_default_pii=False``
at init time already suppresses cookies / IP / headers, but the FastAPI
integration can still attach the JSON body to an event if an exception
fires mid-handler. The scrub hook below is a defensive before_send that
drops the body on any path matching a sensitive-endpoint pattern.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from sentry_sdk.types import Event, Hint

# Paths whose request body contains PII or user-supplied free text.
# Extend this list when new mutating endpoints accept personal fields.
_SENSITIVE_PATH_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^/api/v1/me/profile(?:/|$)"),
    re.compile(r"^/api/v1/tasks/[^/]+/submit(?:/|$)"),
)


def scrub_sensitive_bodies(event: Event, _hint: Hint) -> Event | None:
    """Sentry ``before_send`` hook — drop request body on PII endpoints.

    The hook is tolerant of missing request metadata (non-HTTP events
    like worker exceptions won't have a ``request`` key). Events on
    non-sensitive paths pass through unchanged. We never return None
    (which would drop the event entirely) — only the body is scrubbed.
    """
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
