"""CHECK constraints for Pydantic ge=/le= bounds

Revision ID: c002
Revises: c001
Create Date: 2026-04-20 11:01:00.000000

``Field(ge=0)`` / ``Field(le=1)`` on SQLModel are Pydantic validators —
they only fire on Python-side row construction. A raw SQL ``INSERT``
(seed scripts, ad-hoc psql, future denormalisation jobs) can slip a
negative value past them. These CHECK constraints are the DB backstop.

Autogenerate does not emit ``CheckConstraint`` entries reliably
(``compare_type`` only looks at column types), so this migration is
hand-written.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c002"
down_revision: str | None = "c001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_CHECKS: list[tuple[str, str, str]] = [
    ("teams", "ck_teams_cap_positive", "cap >= 1"),
    ("teams", "ck_teams_points_nonneg", "points >= 0"),
    ("teams", "ck_teams_week_points_nonneg", "week_points >= 0"),
    ("task_defs", "ck_task_defs_points_nonneg", "points >= 0"),
    ("task_defs", "ck_task_defs_est_minutes_nonneg", "est_minutes >= 0"),
    ("task_step_defs", "ck_task_step_defs_order_nonneg", '"order" >= 0'),
    ("task_progress", "ck_task_progress_progress_unit", "progress >= 0 AND progress <= 1"),
]


def upgrade() -> None:
    for table, name, condition in _CHECKS:
        op.create_check_constraint(name, table, condition)


def downgrade() -> None:
    for table, name, _ in reversed(_CHECKS):
        op.drop_constraint(name, table, type_="check")
