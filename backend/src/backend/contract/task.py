"""Task shapes — the user-facing merged view (global definition + caller
state) plus the discriminated form-body union for submissions.

Derivation rules (server-authoritative; frontend must match):
  * `status == "locked"` iff any id in `requires` is not in the caller's
    set of completed task ids.
  * `status == "expired"` iff `due_at` is in the past and the caller has
    not completed the task.
  * `progress` is authoritative; clients display `steps[].done` for the
    checklist UX but never compute `progress` from it.
"""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.contract.rewards import Reward


class TaskStep(BaseModel):
    """One step in a task's checklist. `done` reflects the caller's state."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    label: str
    done: bool
    order: int


class TeamChallengeProgress(BaseModel):
    """Aggregate progress for a team-challenge task.

    `total = max(led_total, joined_total)` — the higher of the caller's
    led-team or joined-team head count (server-computed).
    """

    model_config = ConfigDict(extra="forbid")

    total: int
    cap: int
    led_total: int
    joined_total: int


class Task(BaseModel):
    """User-facing task view. Server-side merge of the global task
    definition and the caller's per-user state."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    display_id: str
    title: str
    summary: str
    description: str
    tag: Literal["探索", "社区", "陪伴"]
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    points: int = Field(ge=0)
    bonus: str | None = None
    due_at: datetime | None = None
    est_minutes: int = Field(ge=0)
    is_challenge: bool = False
    requires: list[UUID] = Field(default_factory=list)
    cap: int | None = None
    form_type: Literal["interest", "ticket"] | None = None
    status: Literal["todo", "in_progress", "completed", "expired", "locked"]
    progress: float | None = Field(default=None, ge=0.0, le=1.0)
    steps: list[TaskStep] = Field(default_factory=list)
    team_progress: TeamChallengeProgress | None = None
    created_at: datetime


class InterestFormBody(BaseModel):
    """POST /tasks/{id}/submit body for tasks with form_type == 'interest'
    (task 1)."""

    model_config = ConfigDict(extra="forbid")

    form_type: Literal["interest"]
    name: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    interests: list[str] = Field(min_length=1)
    skills: list[str] = Field(default_factory=list)
    availability: list[str] = Field(min_length=1)


class TicketFormBody(BaseModel):
    """POST /tasks/{id}/submit body for tasks with form_type == 'ticket'
    (task 2)."""

    model_config = ConfigDict(extra="forbid")

    form_type: Literal["ticket"]
    name: str = Field(min_length=1)
    ticket_725: str = Field(min_length=1)
    ticket_726: str = Field(min_length=1)
    note: str | None = None


SubmitBody = Annotated[
    InterestFormBody | TicketFormBody,
    Field(discriminator="form_type"),
]
"""Discriminated union on `form_type` for the submit endpoint.

Backends should type the request body as this annotated union —
FastAPI/Pydantic emits a tagged `oneOf` into OpenAPI, and generated
TypeScript clients get a clean discriminated union.
"""


class TaskSubmissionResponse(BaseModel):
    """Response body for POST /tasks/{id}/submit.

    `reward` is null when the task has `bonus is None`.
    """

    model_config = ConfigDict(extra="forbid")

    task: Task
    reward: Reward | None = None
