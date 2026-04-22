"""Drop unused team counter columns

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-22 13:00:00.000000

``teams.points`` / ``teams.week_points`` / ``teams.cap`` were persisted
but never mutated by any handler — the real points come from the
leaderboard aggregation (see ``services/leaderboard.py``) and the 6-
member team cap is a property of the T3 challenge task def, not the
team row. Keeping them created a double source of truth where
``GET /teams/{id}`` would return ``points: 0`` while ``GET
/leaderboard/teams`` returned the real aggregate. Drop the columns
(and their CHECK constraints) to eliminate the ambiguity (M6).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("ck_teams_points_nonneg", "teams", type_="check")
    op.drop_constraint("ck_teams_week_points_nonneg", "teams", type_="check")
    op.drop_constraint("ck_teams_cap_positive", "teams", type_="check")
    op.drop_column("teams", "week_points")
    op.drop_column("teams", "points")
    op.drop_column("teams", "cap")


def downgrade() -> None:
    op.add_column(
        "teams",
        sa.Column("cap", sa.Integer(), nullable=False, server_default="6"),
    )
    op.add_column(
        "teams",
        sa.Column("points", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "teams",
        sa.Column("week_points", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_check_constraint("ck_teams_cap_positive", "teams", "cap >= 1")
    op.create_check_constraint("ck_teams_points_nonneg", "teams", "points >= 0")
    op.create_check_constraint(
        "ck_teams_week_points_nonneg",
        "teams",
        "week_points >= 0",
    )
