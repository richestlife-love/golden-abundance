"""FK ON DELETE CASCADE

Revision ID: c004
Revises: c003
Create Date: 2026-04-20 11:03:00.000000

Every child-side FK cascades on parent delete. Matches the TRUNCATE
CASCADE semantics seed-reset and the per-test fixture already rely on
and makes single-row ``DELETE FROM users WHERE id=...`` succeed
instead of failing on FK violations.

The original FKs (migration 0001) were created without explicit
names, so Postgres assigned ``<table>_<column>_fkey``. We look each
one up via ``information_schema`` to avoid baking that assumption into
the migration.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.engine import Connection

from alembic import op

revision: str = "c004"
down_revision: str | None = "c003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_FKS: list[tuple[str, str, str, str]] = [
    ("teams", "leader_id", "users", "id"),
    ("team_memberships", "team_id", "teams", "id"),
    ("team_memberships", "user_id", "users", "id"),
    ("join_requests", "team_id", "teams", "id"),
    ("join_requests", "user_id", "users", "id"),
    ("task_def_requires", "task_def_id", "task_defs", "id"),
    ("task_def_requires", "requires_id", "task_defs", "id"),
    ("task_step_defs", "task_def_id", "task_defs", "id"),
    ("task_progress", "task_def_id", "task_defs", "id"),
    ("task_progress", "user_id", "users", "id"),
    ("task_step_progress", "step_id", "task_step_defs", "id"),
    ("task_step_progress", "user_id", "users", "id"),
    ("rewards", "task_def_id", "task_defs", "id"),
    ("rewards", "user_id", "users", "id"),
]

_FK_LOOKUP = sa.text("""
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = :tbl
      AND kcu.column_name = :col
    LIMIT 1
""")


def _find_fk_name(bind: Connection, table: str, column: str) -> str:
    row = bind.execute(_FK_LOOKUP, {"tbl": table, "col": column}).fetchone()
    if row is None:
        raise RuntimeError(f"No foreign key found on {table}.{column}")
    return row[0]


def _recreate(ondelete: str | None) -> None:
    bind = op.get_bind()
    for table, column, ref_table, ref_col in _FKS:
        existing = _find_fk_name(bind, table, column)
        op.drop_constraint(existing, table, type_="foreignkey")
        op.create_foreign_key(
            f"{table}_{column}_fkey",
            source_table=table,
            referent_table=ref_table,
            local_cols=[column],
            remote_cols=[ref_col],
            ondelete=ondelete,
        )


def upgrade() -> None:
    _recreate(ondelete="CASCADE")


def downgrade() -> None:
    _recreate(ondelete=None)
