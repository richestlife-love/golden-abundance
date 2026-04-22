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

from sqlalchemy import JSON, CheckConstraint, Column, DateTime, Index, String, UniqueConstraint, text
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class UserRow(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(primary_key=True)
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
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
            server_default=text("now()"),
        ),
    )


class TeamRow(SQLModel, table=True):
    __tablename__ = "teams"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    display_id: str = Field(index=True, unique=True, max_length=16)
    name: str
    alias: str | None = None
    topic: str = Field(default="尚未指定主題")
    # One led team per user: enforced by unique=True so `GET /me/teams`
    # can scalar_one_or_none() the lookup.
    leader_id: UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True, unique=True)
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
            server_default=text("now()"),
        ),
    )


class TeamMembershipRow(SQLModel, table=True):
    __tablename__ = "team_memberships"
    __table_args__ = (UniqueConstraint("user_id", name="uq_membership_user"),)

    team_id: UUID = Field(foreign_key="teams.id", ondelete="CASCADE", primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", ondelete="CASCADE", primary_key=True)
    joined_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
            server_default=text("now()"),
        ),
    )


class JoinRequestRow(SQLModel, table=True):
    __tablename__ = "join_requests"
    # Partial unique index closes the at-most-one-pending-per-user race
    # the service-layer check in `create_join_request` can lose under
    # concurrent requests. Mirrors the `uq_reward_user_task` backstop
    # for double-award races.
    __table_args__ = (
        Index(
            "uq_join_requests_one_pending_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    team_id: UUID = Field(foreign_key="teams.id", ondelete="CASCADE", index=True)
    user_id: UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    status: Literal["pending", "approved", "rejected"] = Field(
        default="pending",
        sa_column=Column(String(16), nullable=False, default="pending"),
    )
    requested_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
            server_default=text("now()"),
        ),
    )


class TaskDefRow(SQLModel, table=True):
    __tablename__ = "task_defs"
    __table_args__ = (
        CheckConstraint("points >= 0", name="ck_task_defs_points_nonneg"),
        CheckConstraint("est_minutes >= 0", name="ck_task_defs_est_minutes_nonneg"),
    )

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
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
            server_default=text("now()"),
        ),
    )


class TaskDefRequiresRow(SQLModel, table=True):
    """Task-def → prerequisite task-def (many-to-many self-link)."""

    __tablename__ = "task_def_requires"

    task_def_id: UUID = Field(foreign_key="task_defs.id", ondelete="CASCADE", primary_key=True)
    requires_id: UUID = Field(foreign_key="task_defs.id", ondelete="CASCADE", primary_key=True)


class TaskStepDefRow(SQLModel, table=True):
    __tablename__ = "task_step_defs"
    __table_args__ = (
        UniqueConstraint("task_def_id", "order", name="uq_step_order"),
        CheckConstraint('"order" >= 0', name="ck_task_step_defs_order_nonneg"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    task_def_id: UUID = Field(foreign_key="task_defs.id", ondelete="CASCADE", index=True)
    label: str
    order: int = Field(ge=0)


class TaskProgressRow(SQLModel, table=True):
    __tablename__ = "task_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "task_def_id", name="uq_progress_user_task"),
        CheckConstraint("progress >= 0 AND progress <= 1", name="ck_task_progress_progress_unit"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    task_def_id: UUID = Field(foreign_key="task_defs.id", ondelete="CASCADE", index=True)
    status: Literal["todo", "in_progress", "completed"] = Field(
        default="todo",
        sa_column=Column(String(16), nullable=False, default="todo"),
    )
    progress: float | None = Field(default=None, ge=0.0, le=1.0)
    form_submission: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    completed_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
            server_default=text("now()"),
        ),
    )


class TaskStepProgressRow(SQLModel, table=True):
    __tablename__ = "task_step_progress"
    __table_args__ = (UniqueConstraint("user_id", "step_id", name="uq_step_progress_user_step"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    step_id: UUID = Field(foreign_key="task_step_defs.id", ondelete="CASCADE", index=True)
    done: bool = Field(default=False)


class RewardRow(SQLModel, table=True):
    __tablename__ = "rewards"
    __table_args__ = (UniqueConstraint("user_id", "task_def_id", name="uq_reward_user_task"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    task_def_id: UUID = Field(foreign_key="task_defs.id", ondelete="CASCADE", index=True)
    task_title: str
    bonus: str
    status: Literal["earned", "claimed"] = Field(
        default="earned",
        sa_column=Column(String(16), nullable=False, default="earned"),
    )
    earned_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
            server_default=text("now()"),
        ),
    )
    claimed_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))


class NewsItemRow(SQLModel, table=True):
    __tablename__ = "news_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str
    body: str
    category: Literal["公告", "活動", "通知"] = Field(sa_column=Column(String(16), nullable=False))
    image_url: str | None = None
    published_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
            server_default=text("now()"),
            index=True,
        ),
    )
    pinned: bool = Field(default=False, index=True)
