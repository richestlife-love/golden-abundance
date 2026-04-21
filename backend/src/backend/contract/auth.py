"""Wire-format shapes for auth flow.

``SupabaseClaims`` is the deserialized form of a Supabase-issued JWT's
payload. Only the fields the backend enforces or reads are declared;
extra keys (user_metadata, app_metadata, role, session_id, etc.) are
ignored by pydantic's default.
"""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SupabaseClaims(BaseModel):
    """Subset of a Supabase access-token's JWT payload.

    ``email`` is plain ``str`` (not ``EmailStr``) because Supabase has
    already validated it on issuance; re-validating would only add a
    runtime dep on ``email-validator`` for zero security win.
    """

    model_config = ConfigDict(extra="ignore")

    sub: UUID
    email: str
    aud: str
    exp: int
    iat: int
