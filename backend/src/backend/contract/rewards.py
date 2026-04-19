"""Reward shapes. Earned when tasks with a non-null `bonus` are completed.

Rewardless tasks (`Task.bonus is None`) do NOT create Reward rows, so
`Reward.bonus` is always non-null by construction.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class Reward(BaseModel):
    """A user's earned (or claimed) reward."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    user_id: UUID
    task_id: UUID
    task_title: str
    bonus: str
    status: Literal["earned", "claimed"]
    earned_at: datetime
    claimed_at: datetime | None = None
