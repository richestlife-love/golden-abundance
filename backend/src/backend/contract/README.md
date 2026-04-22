# `backend.contract`

The Phase 2 API contract: Pydantic 2 models describing the wire format
between the frontend and the FastAPI backend. See the full design at
[`../../../../docs/superpowers/specs/2026-04-19-phase-2-api-contract-design.md`](../../../../docs/superpowers/specs/2026-04-19-phase-2-api-contract-design.md)
and the endpoint catalog at [`endpoints.md`](endpoints.md).

## Consume

```python
from backend.contract import (
    # Shared
    Paginated, UserRef, TeamRef,
    # User
    User, ProfileCreate, ProfileUpdate,
    # Task
    Task, TaskStep, TeamChallengeProgress,
    InterestFormBody, TicketFormBody, SubmitBody,
    TaskSubmissionResponse,
    # Team
    Team, JoinRequest, TeamUpdate, MeTeamsResponse, MeProfileCreateResponse,
    # Leaderboard
    UserLeaderboardEntry, TeamLeaderboardEntry, LeaderboardPeriod,
    # Rewards & News
    Reward, NewsItem,
)
```

Auth is owned by Supabase (frontend SDK); the backend exposes
`SupabaseClaims` via `backend.contract` for type-hinting JWT payloads it
receives, but no request/response auth shape is re-exported because the
backend never issues tokens.

## Modules

| File             | Contents                                                                         |
|------------------|----------------------------------------------------------------------------------|
| `auth.py`        | `SupabaseClaims`                                                                 |
| `common.py`      | `UserRef`, `TeamRef`, `Paginated[T]`                                             |
| `news.py`        | `NewsItem`                                                                       |
| `leaderboard.py` | `UserLeaderboardEntry`, `TeamLeaderboardEntry`, `LeaderboardPeriod`              |
| `rewards.py`     | `Reward`                                                                         |
| `task.py`        | `Task`, `TaskStep`, `TeamChallengeProgress`, `InterestFormBody`, `TicketFormBody`, `SubmitBody`, `TaskSubmissionResponse` |
| `team.py`        | `Team`, `JoinRequest`, `TeamUpdate`, `MeTeamsResponse`, `MeProfileCreateResponse` |
| `user.py`        | `User`, `ProfileCreate`, `ProfileUpdate`                                         |
| `endpoints.md`   | Human-readable endpoint catalog                                                  |
| `examples/`      | JSON fixtures named by endpoint (flat directory)                                 |
| `validate_examples.py` | Smoke test: loads each fixture and validates against its Pydantic model    |

## Validate

From `backend/` (or any subdirectory of it — `just` walks upward to find
`backend/justfile`):

```
just contract-validate
```

From the repo root: `just -f backend/justfile contract-validate`.

Exits 0 on success; non-zero if any fixture fails to parse against its
declared model. Run this any time you add or change a model or fixture.

## Using `SubmitBody`

`POST /tasks/{task_id}/submit` takes a discriminated union on
`form_type`. Use `SubmitBody` as the request-body annotation in FastAPI:

```python
from fastapi import APIRouter
from backend.contract import SubmitBody, TaskSubmissionResponse

router = APIRouter()

@router.post("/tasks/{task_id}/submit")
async def submit_task(task_id: UUID, body: SubmitBody) -> TaskSubmissionResponse:
    match body.form_type:
        case "interest":
            ...  # body is InterestFormBody here
        case "ticket":
            ...  # body is TicketFormBody here
```

FastAPI emits a tagged `oneOf` into OpenAPI based on the discriminator,
and generated TypeScript clients get a clean discriminated union.

## Paginated list responses

Any endpoint returning a cursor-paginated list should annotate its
response as `Paginated[Foo]`, not a bare `list[Foo]`. Pydantic's generic
caching makes this free at runtime, and FastAPI emits a parameterised
schema so downstream TS codegen sees `Paginated<Foo>` rather than an
anonymous envelope per endpoint.

```python
from backend.contract import NewsItem, Paginated

@router.get("/news")
async def list_news(cursor: str | None = None) -> Paginated[NewsItem]:
    ...
```
