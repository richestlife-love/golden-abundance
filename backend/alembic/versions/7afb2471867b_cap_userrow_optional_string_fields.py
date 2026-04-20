"""cap UserRow optional string fields

Revision ID: 7afb2471867b
Revises: 0001
Create Date: 2026-04-20 03:01:13.192308

Alembic's default `compare_type` treats unbounded VARCHAR as compatible
with VARCHAR(n), so autogenerate emitted an empty migration for this
tightening; the statements below were written by hand.
"""

from collections.abc import Sequence

import sqlmodel.sql.sqltypes

from alembic import op

revision: str = "7afb2471867b"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_CAPS: dict[str, int] = {
    "zh_name": 64,
    "en_name": 64,
    "nickname": 64,
    "phone": 32,
    "phone_code": 8,
    "line_id": 64,
    "telegram_id": 64,
    "country": 64,
    "location": 128,
    "avatar_url": 2048,
}


def upgrade() -> None:
    for col, length in _CAPS.items():
        op.alter_column(
            "users",
            col,
            type_=sqlmodel.sql.sqltypes.AutoString(length=length),
            existing_type=sqlmodel.sql.sqltypes.AutoString(),
            existing_nullable=True,
        )


def downgrade() -> None:
    for col, length in _CAPS.items():
        op.alter_column(
            "users",
            col,
            type_=sqlmodel.sql.sqltypes.AutoString(),
            existing_type=sqlmodel.sql.sqltypes.AutoString(length=length),
            existing_nullable=True,
        )
