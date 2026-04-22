"""User shapes: full profile response and profile create/update bodies.

Field derivation rules (server-authoritative):
  * `name`: zh_name if set, else nickname, else display_id.
  * `profile_complete`: True once POST /me/profile has run.

Length caps on ProfileCreate/ProfileUpdate match the DB column caps in
``backend.db.models`` — sending a longer value yields a 422 at the API
boundary instead of leaking to an IntegrityError 500 at flush (M7).
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

    zh_name: str = Field(min_length=1, max_length=64)
    en_name: str | None = Field(default=None, min_length=1, max_length=64)
    nickname: str | None = Field(default=None, min_length=1, max_length=64)
    phone: str = Field(min_length=1, max_length=32)
    phone_code: str = Field(min_length=1, max_length=8)
    line_id: str | None = Field(default=None, min_length=1, max_length=64)
    telegram_id: str | None = Field(default=None, min_length=1, max_length=64)
    country: str = Field(min_length=1, max_length=64)
    location: str = Field(min_length=1, max_length=128)


class ProfileUpdate(StrictModel):
    """Request body for PATCH /me. Partial update; all fields optional.

    Setting a field to ``null`` clears it; empty strings are rejected.
    Fields omitted from the request are left unchanged.
    """

    zh_name: str | None = Field(default=None, min_length=1, max_length=64)
    en_name: str | None = Field(default=None, min_length=1, max_length=64)
    nickname: str | None = Field(default=None, min_length=1, max_length=64)
    phone: str | None = Field(default=None, min_length=1, max_length=32)
    phone_code: str | None = Field(default=None, min_length=1, max_length=8)
    line_id: str | None = Field(default=None, min_length=1, max_length=64)
    telegram_id: str | None = Field(default=None, min_length=1, max_length=64)
    country: str | None = Field(default=None, min_length=1, max_length=64)
    location: str | None = Field(default=None, min_length=1, max_length=128)
