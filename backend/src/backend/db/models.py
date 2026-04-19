"""SQLModel persistence tables.

Every table has a UUID primary key (random v4 by default) and a
``created_at`` column with UTC default. Nothing here is re-exported from
``backend.contract`` — these shapes are internal to the backend.

Enum-like string columns: every ``Literal[...]`` field declares an
explicit ``sa_column=Column(String(16), ...)`` so both
``metadata.create_all`` (tests) and Alembic autogenerate (migrations)
emit VARCHAR. SQLModel's implicit handling of ``Literal`` has varied
across versions; the explicit column eliminates the ambiguity and
lets values grow without PG enum surgery.
"""

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, DateTime, String, UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class UserRow(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    display_id: str = Field(index=True, unique=True, max_length=16)
    email: str = Field(index=True, unique=True, max_length=320)
    zh_name: str | None = Field(default=None, max_length=64)
    en_name: str | None = Field(default=None, max_length=64)
    nickname: str | None = Field(default=None, max_length=64)
    phone: str | None = Field(default=None, max_length=32)
    phone_code: str | None = Field(default=None, max_length=8)
    line_id: str | None = Field(default=None, max_length=64)
    telegram_id: str | None = Field(default=None, max_length=64)
    country: str | None = Field(default=None, max_length=64)
    location: str | None = Field(default=None, max_length=128)
    avatar_url: str | None = Field(default=None, max_length=2048)
    profile_complete: bool = Field(default=False)
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow))


class TeamRow(SQLModel, table=True):
    __tablename__ = "teams"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    display_id: str = Field(index=True, unique=True, max_length=16)
    name: str
    alias: str | None = None
    topic: str = Field(default="尚未指定主題")
    leader_id: UUID = Field(foreign_key="users.id", index=True, unique=True)
    cap: int = Field(default=6, ge=1)
    points: int = Field(default=0, ge=0)
    week_points: int = Field(default=0, ge=0)
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow))


class TeamMembershipRow(SQLModel, table=True):
    __tablename__ = "team_memberships"
    __table_args__ = (UniqueConstraint("user_id", name="uq_membership_user"),)

    team_id: UUID = Field(foreign_key="teams.id", primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", primary_key=True)
    joined_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow))


class JoinRequestRow(SQLModel, table=True):
    __tablename__ = "join_requests"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    team_id: UUID = Field(foreign_key="teams.id", index=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    status: Literal["pending", "approved", "rejected"] = Field(
        default="pending",
        sa_column=Column(String(16), nullable=False, default="pending"),
    )
    requested_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow))


class TaskDefRow(SQLModel, table=True):
    __tablename__ = "task_defs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    display_id: str = Field(index=True, unique=True, max_length=16)
    title: str
    summary: str
    description: str
    tag: Literal["探索", "社区", "陪伴"] = Field(sa_column=Column(String(16), nullable=False))
    color: str
    points: int = Field(ge=0)
    bonus: str | None = None
    due_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    est_minutes: int = Field(ge=0)
    is_challenge: bool = Field(default=False)
    cap: int | None = None
    form_type: Literal["interest", "ticket"] | None = Field(
        default=None,
        sa_column=Column(String(16), nullable=True),
    )
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow))


class TaskDefRequiresRow(SQLModel, table=True):
    """Task-def → prerequisite task-def (many-to-many self-link)."""

    __tablename__ = "task_def_requires"

    task_def_id: UUID = Field(foreign_key="task_defs.id", primary_key=True)
    requires_id: UUID = Field(foreign_key="task_defs.id", primary_key=True)


class TaskStepDefRow(SQLModel, table=True):
    __tablename__ = "task_step_defs"
    __table_args__ = (UniqueConstraint("task_def_id", "order", name="uq_step_order"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    task_def_id: UUID = Field(foreign_key="task_defs.id", index=True)
    label: str
    order: int = Field(ge=0)


class TaskProgressRow(SQLModel, table=True):
    __tablename__ = "task_progress"
    __table_args__ = (UniqueConstraint("user_id", "task_def_id", name="uq_progress_user_task"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    task_def_id: UUID = Field(foreign_key="task_defs.id", index=True)
    status: Literal["todo", "in_progress", "completed"] = Field(
        default="todo",
        sa_column=Column(String(16), nullable=False, default="todo"),
    )
    progress: float | None = Field(default=None, ge=0.0, le=1.0)
    form_submission: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    completed_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    updated_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow))


class TaskStepProgressRow(SQLModel, table=True):
    __tablename__ = "task_step_progress"
    __table_args__ = (UniqueConstraint("user_id", "step_id", name="uq_step_progress_user_step"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    step_id: UUID = Field(foreign_key="task_step_defs.id", index=True)
    done: bool = Field(default=False)


class RewardRow(SQLModel, table=True):
    __tablename__ = "rewards"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    task_def_id: UUID = Field(foreign_key="task_defs.id", index=True)
    task_title: str
    bonus: str
    status: Literal["earned", "claimed"] = Field(
        default="earned",
        sa_column=Column(String(16), nullable=False, default="earned"),
    )
    earned_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow))
    claimed_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))


class NewsItemRow(SQLModel, table=True):
    __tablename__ = "news_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str
    body: str
    category: Literal["公告", "活動", "通知"] = Field(sa_column=Column(String(16), nullable=False))
    image_url: str | None = None
    published_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    )
    pinned: bool = Field(default=False, index=True)
