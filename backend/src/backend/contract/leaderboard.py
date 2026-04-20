"""Leaderboard shapes — one per user, one per team, both filterable by
period ("week" / "month" / "all_time"). Wrapped in Paginated[T] at the
endpoint level.
"""

from typing import Literal

from backend.contract.common import StrictModel, TeamRef, UserRef

LeaderboardPeriod = Literal["week", "month", "all_time"]


class UserLeaderboardEntry(StrictModel):
    """Single entry in the user leaderboard."""

    user: UserRef
    rank: int
    points: int
    week_points: int


class TeamLeaderboardEntry(StrictModel):
    """Single entry in the team leaderboard."""

    team: TeamRef
    rank: int
    points: int
    week_points: int
