"""Auth request/response shapes for the Google OAuth sign-in flow.

TokenClaims is intentionally NOT re-exported from backend.contract; it
describes the JWT payload the backend should encode for documentation
only, and is never used as a request or response body.
"""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from backend.contract.user import User


class GoogleAuthRequest(BaseModel):
    """Request body for POST /auth/google."""

    model_config = ConfigDict(extra="forbid")

    id_token: str


class AuthResponse(BaseModel):
    """Response body for POST /auth/google.

    `profile_complete` mirrors `user.profile_complete` for convenience
    on the client so the first screen routing decision can be made
    without a second round-trip.
    """

    model_config = ConfigDict(extra="forbid")

    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: User
    profile_complete: bool


class TokenClaims(BaseModel):
    """JWT payload shape (documentation only).

    NOT a request/response body and NOT re-exported from
    backend.contract — this model exists so backend authors have a
    Pydantic description of what to encode in the access_token.
    """

    model_config = ConfigDict(extra="forbid")

    sub: UUID
    email: EmailStr
    exp: int
    iat: int
