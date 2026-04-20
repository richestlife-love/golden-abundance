"""Phase 2 API contract — Pydantic 2 models shared between the frontend
and the FastAPI backend. See `endpoints.md` for the endpoint catalog and
`README.md` for a consumer guide.

Usage::

    from backend.contract import User, Task, Team, AuthResponse, Paginated

`TokenClaims` is intentionally not re-exported — it describes the JWT
payload shape for documentation only and is not a request/response body.
"""

from backend.contract.auth import AuthResponse, GoogleAuthRequest
from backend.contract.common import Paginated, TeamRef, UserRef
from backend.contract.leaderboard import (
    LeaderboardPeriod,
    TeamLeaderboardEntry,
    UserLeaderboardEntry,
)
from backend.contract.news import NewsItem
from backend.contract.reward import Reward
from backend.contract.task import (
    InterestFormBody,
    SubmitBody,
    Task,
    TaskStep,
    TaskSubmissionResponse,
    TeamChallengeProgress,
    TicketFormBody,
)
from backend.contract.team import (
    JoinRequest,
    MeProfileCreateResponse,
    MeTeamsResponse,
    Team,
    TeamUpdate,
)
from backend.contract.user import ProfileCreate, ProfileUpdate, User

__all__ = [
    "AuthResponse",
    "GoogleAuthRequest",
    "InterestFormBody",
    "JoinRequest",
    "LeaderboardPeriod",
    "MeProfileCreateResponse",
    "MeTeamsResponse",
    "NewsItem",
    "Paginated",
    "ProfileCreate",
    "ProfileUpdate",
    "Reward",
    "SubmitBody",
    "Task",
    "TaskStep",
    "TaskSubmissionResponse",
    "Team",
    "TeamChallengeProgress",
    "TeamLeaderboardEntry",
    "TeamRef",
    "TeamUpdate",
    "TicketFormBody",
    "User",
    "UserLeaderboardEntry",
    "UserRef",
]
