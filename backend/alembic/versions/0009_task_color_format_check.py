"""task_defs.color format CHECK constraint

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-22 13:40:00.000000

Pydantic validates ``color`` against ``^#[0-9a-fA-F]{6}$`` at the API
boundary, but a raw SQL INSERT (``psql``, seed scripts, a future ORM
that skips Pydantic) could sneak in an out-of-format value. Add the
same regex as a DB-side CHECK so the pattern is enforced at both tiers
(L13).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLOR_RE = r"color ~ '^#[0-9a-fA-F]{6}$'"


def upgrade() -> None:
    op.create_check_constraint("ck_task_defs_color_format", "task_defs", _COLOR_RE)


def downgrade() -> None:
    op.drop_constraint("ck_task_defs_color_format", "task_defs", type_="check")
