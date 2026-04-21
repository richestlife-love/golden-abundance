"""User shapes: full profile response and profile create/update bodies.

Field derivation rules (server-authoritative):
  * `name`: zh_name if set, else nickname, else email-local-part.
  * `profile_complete`: True once POST /me/profile has run.
"""

from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field

from backend.contract.common import StrictModel


class User(StrictModel):
    """Authenticated caller's profile. Returned by GET /me."""

    id: UUID
    display_id: str = Field(pattern=r"^U[A-Z0-9]{3,7}$")
    email: EmailStr
    zh_name: str | None = None
    en_name: str | None = None
    nickname: str | None = None
    name: str
    phone: str | None = None
    phone_code: str | None = None
    line_id: str | None = None
    telegram_id: str | None = None
    country: str | None = None
    location: str | None = None
    avatar_url: str | None = None
    profile_complete: bool
    created_at: datetime


class ProfileCreate(StrictModel):
    """Request body for POST /me/profile (first-time profile completion).
    Side effect on the backend: user's led team is created in the same
    transaction.
    """

    zh_name: str = Field(min_length=1)
    en_name: str | None = None
    nickname: str | None = None
    phone: str = Field(min_length=1)
    phone_code: str = Field(min_length=1)
    line_id: str | None = None
    telegram_id: str | None = None
    country: str = Field(min_length=1)
    location: str = Field(min_length=1)


class ProfileUpdate(StrictModel):
    """Request body for PATCH /me. Partial update; all fields optional."""

    zh_name: str | None = None
    en_name: str | None = None
    nickname: str | None = None
    phone: str | None = None
    phone_code: str | None = None
    line_id: str | None = None
    telegram_id: str | None = None
    country: str | None = None
    location: str | None = None
