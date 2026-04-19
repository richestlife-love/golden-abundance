from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.user import row_to_contract_user, upsert_user_by_email


async def test_upsert_creates_on_first_sight(session: AsyncSession) -> None:
    user = await upsert_user_by_email(session, email="new@example.com")
    await session.commit()
    assert user.email == "new@example.com"
    assert user.profile_complete is False
    assert user.display_id.startswith("U")


async def test_upsert_is_idempotent(session: AsyncSession) -> None:
    first = await upsert_user_by_email(session, email="same@example.com")
    await session.commit()
    second = await upsert_user_by_email(session, email="same@example.com")
    await session.commit()
    assert first.id == second.id


async def test_row_to_contract_user_derives_name_from_zh_name(session: AsyncSession) -> None:
    user = await upsert_user_by_email(session, email="x@example.com")
    user.zh_name = "簡傑特"
    user.nickname = "Jet"
    contract = row_to_contract_user(user)
    assert contract.name == "簡傑特"


async def test_row_to_contract_user_falls_back_to_nickname(session: AsyncSession) -> None:
    user = await upsert_user_by_email(session, email="y@example.com")
    user.zh_name = None
    user.nickname = "Jet"
    contract = row_to_contract_user(user)
    assert contract.name == "Jet"


async def test_row_to_contract_user_falls_back_to_email_local_part(session: AsyncSession) -> None:
    user = await upsert_user_by_email(session, email="foo@example.com")
    contract = row_to_contract_user(user)
    assert contract.name == "foo"


async def test_row_to_contract_user_treats_empty_strings_as_absent(session: AsyncSession) -> None:
    """Empty ``zh_name``/``nickname`` must fall through to the next option."""
    user = await upsert_user_by_email(session, email="bar@example.com")
    user.zh_name = ""
    user.nickname = "Jet"
    assert row_to_contract_user(user).name == "Jet"

    user.zh_name = ""
    user.nickname = ""
    assert row_to_contract_user(user).name == "bar"


def test_row_to_contract_user_maps_every_contract_field() -> None:
    """Drift guard: every non-derived ContractUser field must come from a UserRow column."""
    from backend.contract import User as ContractUser
    from backend.db.models import UserRow

    contract_fields = set(ContractUser.model_fields) - {"name"}
    row_fields = set(UserRow.model_fields)
    missing = contract_fields - row_fields
    assert not missing, f"Contract fields not in UserRow: {missing}"
