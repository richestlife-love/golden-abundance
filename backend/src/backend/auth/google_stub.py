"""Phase-5 stub for Google ID-token verification.

Real implementation lands in Phase 6: verify signature against
Google's JWKS, validate `aud` / `iss` / `exp`, and extract `email`.

The stub treats the raw token string as the authenticated email. Tests
and local dev can post ``{"id_token": "jet@example.com"}`` to
``POST /auth/google``. Any "@"-less input is rejected so tests accidentally
passing a real token shape don't silently succeed.
"""

from email_validator import EmailNotValidError, validate_email


def verify_id_token(raw: str) -> str:
    if not raw:
        raise ValueError("id_token is empty")
    try:
        info = validate_email(raw, check_deliverability=False)
    except EmailNotValidError as exc:
        raise ValueError(f"stub id_token must be an email in Phase 5: {exc}") from exc
    # Lowercase defensively: email local-part case is RFC-technically preserved
    # but real-world auth treats the full email as case-insensitive.
    return info.normalized.lower()
