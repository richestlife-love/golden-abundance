"""Shared primitives used across contract entities.

`UserRef` / `TeamRef` are thin embeddings used inside other response
models. `Paginated[T]` is the cursor-based list envelope.
"""
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class UserRef(BaseModel):
    """Thin user embedding (id + display_id + name + avatar_url)."""
    model_config = ConfigDict(extra="forbid")

    id: UUID
    display_id: str
    name: str
    avatar_url: str | None = None


class TeamRef(BaseModel):
    """Thin team embedding for leaderboard entries and search results."""
    model_config = ConfigDict(extra="forbid")

    id: UUID
    display_id: str
    name: str
    topic: str
    leader: UserRef


class Paginated(BaseModel, Generic[T]):
    """Cursor-paginated list envelope.

    `next_cursor` is the cursor to pass on the next call; ``None`` means
    no more pages. No `total` field — add later if a screen needs it.
    """
    model_config = ConfigDict(extra="forbid")

    items: list[T]
    next_cursor: str | None = None
