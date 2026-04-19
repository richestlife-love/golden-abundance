"""Leaderboard shapes — one per user, one per team, both filterable by
period ("week" / "month" / "all_time"). Wrapped in Paginated[T] at the
endpoint level."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

from backend.contract.common import TeamRef, UserRef

RankPeriod = Literal["week", "month", "all_time"]


class UserRankEntry(BaseModel):
    """Single entry in the user leaderboard."""

    model_config = ConfigDict(extra="forbid")

    user: UserRef
    rank: int
    points: int
    week_points: int


class TeamRankEntry(BaseModel):
    """Single entry in the team leaderboard."""

    model_config = ConfigDict(extra="forbid")

    team: TeamRef
    rank: int
    points: int
    week_points: int
