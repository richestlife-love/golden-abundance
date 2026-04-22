"""Unit tests for the Sentry before_send scrub hook (M1)."""

from __future__ import annotations

from typing import Any, cast

from sentry_sdk.types import Event

from backend.observability import scrub_sensitive_bodies


def _event(path: str, data: Any) -> Event:
    return cast(
        "Event",
        {
            "request": {
                "url": f"http://api.example.com{path}",
                "data": data,
            },
        },
    )


def _scrub(event: Event) -> dict[str, Any]:
    result = scrub_sensitive_bodies(event, {})
    assert result is not None, "scrub hook never drops events"
    return cast("dict[str, Any]", result)


def test_scrub_drops_body_on_profile_endpoint() -> None:
    event = _event("/api/v1/me/profile", {"phone": "0912345678", "zh_name": "Jet"})
    scrubbed = _scrub(event)
    assert "data" not in scrubbed["request"]
    assert "url" in scrubbed["request"]  # URL itself is untouched — path is needed for routing


def test_scrub_drops_body_on_task_submit() -> None:
    event = _event("/api/v1/tasks/abc123/submit", {"notes": "private stuff"})
    scrubbed = _scrub(event)
    assert "data" not in scrubbed["request"]


def test_scrub_drops_body_on_task_submit_with_trailing_segment() -> None:
    event = _event("/api/v1/tasks/abc123/submit/extra", {"foo": "bar"})
    scrubbed = _scrub(event)
    assert "data" not in scrubbed["request"]


def test_scrub_preserves_body_on_innocuous_endpoint() -> None:
    event = _event("/api/v1/news", {"page": 1})
    scrubbed = _scrub(event)
    assert scrubbed["request"]["data"] == {"page": 1}


def test_scrub_also_drops_json_body_key() -> None:
    event = cast(
        "Event",
        {
            "request": {
                "url": "http://api.example.com/api/v1/me/profile",
                "data": {"phone": "x"},
                "json_body": {"phone": "x"},
            },
        },
    )
    scrubbed = _scrub(event)
    assert "data" not in scrubbed["request"]
    assert "json_body" not in scrubbed["request"]


def test_scrub_handles_event_without_request() -> None:
    """Non-HTTP events (background workers, CLI) lack a request — must not crash."""
    event = cast("Event", {"level": "error", "message": "boom"})
    scrubbed = _scrub(event)
    assert scrubbed == event


def test_scrub_does_not_confuse_similar_path_prefix() -> None:
    """/api/v1/me/profile-ish must NOT match /api/v1/me/profile."""
    event = _event("/api/v1/me/profilefoo", {"marker": "keep me"})
    scrubbed = _scrub(event)
    assert scrubbed["request"]["data"] == {"marker": "keep me"}
