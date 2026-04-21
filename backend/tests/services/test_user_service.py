"""Tests for backend.services.user."""

from datetime import UTC, datetime
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import UserRow
from backend.services.user import (
    derive_user_name,
    row_to_contract_user,
    upsert_user_by_supabase_identity,
)


@pytest.mark.asyncio
async def test_upsert_creates_new_row_with_supabase_id(session: AsyncSession) -> None:
    auth_id = UUID(int=1001)
    row = await upsert_user_by_supabase_identity(
        session,
        auth_user_id=auth_id,
        email="jet@example.com",
    )
    assert row.id == auth_id
    assert row.email == "jet@example.com"
    assert row.display_id.startswith("UJET")
    assert row.profile_complete is False


@pytest.mark.asyncio
async def test_upsert_is_idempotent_on_same_auth_id(session: AsyncSession) -> None:
    auth_id = UUID(int=1002)
    r1 = await upsert_user_by_supabase_identity(
        session,
        auth_user_id=auth_id,
        email="jet@example.com",
    )
    await session.commit()
    r2 = await upsert_user_by_supabase_identity(
        session,
        auth_user_id=auth_id,
        email="jet@example.com",
    )
    assert r1.id == r2.id
    assert r1.display_id == r2.display_id


@pytest.mark.asyncio
async def test_upsert_reuses_existing_row_on_auth_id_match(
    session: AsyncSession,
) -> None:
    """If a row with this UUID already exists (e.g., seeded), reuse it rather than create a collision."""
    auth_id = UUID(int=1003)
    session.add(UserRow(id=auth_id, display_id="SEED1", email="seeded@example.com"))
    await session.commit()

    row = await upsert_user_by_supabase_identity(
        session,
        auth_user_id=auth_id,
        email="seeded@example.com",
    )
    assert row.id == auth_id
    assert row.display_id == "SEED1"


def test_derive_user_name_falls_back_to_email_local_part() -> None:
    row = UserRow(id=UUID(int=1), display_id="X", email="jet.kan@example.com")
    assert derive_user_name(row) == "jet.kan"


def test_derive_user_name_prefers_zh_name() -> None:
    row = UserRow(
        id=UUID(int=1),
        display_id="X",
        email="x@example.com",
        zh_name="金杰",
        nickname="Jet",
    )
    assert derive_user_name(row) == "金杰"


def test_row_to_contract_user_maps_every_field() -> None:
    row = UserRow(
        id=UUID(int=1),
        display_id="UJET1",
        email="jet@example.com",
        zh_name="金杰",
        profile_complete=True,
        created_at=datetime(2026, 4, 21, tzinfo=UTC),
    )
    contract = row_to_contract_user(row)
    assert contract.id == row.id
    assert contract.display_id == "UJET1"
    assert contract.zh_name == "金杰"
    assert contract.name == "金杰"
    assert contract.profile_complete is True


def test_row_to_contract_user_maps_every_contract_field() -> None:
    """Drift guard: every non-derived ContractUser field must come from a UserRow column."""
    from backend.contract import User as ContractUser

    contract_fields = set(ContractUser.model_fields) - {"name"}
    row_fields = set(UserRow.model_fields)
    missing = contract_fields - row_fields
    assert not missing, f"Contract fields not in UserRow: {missing}"
