from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import TaskProgressRow
from backend.services.task import list_caller_tasks, row_to_contract_task
from backend.services.user import upsert_user_by_email


async def test_task_status_todo_by_default(session: AsyncSession, seeded_task_defs) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()

    task = await row_to_contract_task(session, seeded_task_defs["T1"], caller=user)
    assert task.status == "todo"
    assert task.progress is None


async def test_task_status_locked_when_prereq_unmet(
    session: AsyncSession, seeded_task_defs
) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    task = await row_to_contract_task(session, seeded_task_defs["T2"], caller=user)
    assert task.status == "locked"


async def test_task_status_unlocks_when_prereq_completed(
    session: AsyncSession, seeded_task_defs
) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    session.add(
        TaskProgressRow(  # ty: ignore[missing-argument]
            user_id=user.id,
            task_def_id=seeded_task_defs["T1"].id,
            status="completed",
            progress=1.0,
        )
    )
    await session.commit()
    task = await row_to_contract_task(session, seeded_task_defs["T2"], caller=user)
    assert task.status == "todo"


async def test_task_status_expired_for_past_due(
    session: AsyncSession, seeded_task_defs
) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    task = await row_to_contract_task(session, seeded_task_defs["T4"], caller=user)
    assert task.status == "expired"


async def test_challenge_task_computes_team_progress(
    session: AsyncSession, seeded_task_defs
) -> None:
    from backend.db.models import TeamMembershipRow
    from backend.services.team import create_led_team

    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    team = await create_led_team(session, user)
    for email in ("a@example.com", "b@example.com"):
        m = await upsert_user_by_email(session, email=email)
        await session.flush()
        session.add(TeamMembershipRow(team_id=team.id, user_id=m.id))  # ty: ignore[missing-argument]
    await session.commit()

    task = await row_to_contract_task(session, seeded_task_defs["T3"], caller=user)
    assert task.team_progress is not None
    assert task.team_progress.cap == 6
    assert task.team_progress.led_total == 3
    assert task.team_progress.total == 3
    assert task.status == "in_progress"


async def test_challenge_at_cap_is_completed(
    session: AsyncSession, seeded_task_defs
) -> None:
    """When total == cap, status must flip to 'completed' (reward trigger edge)."""
    from backend.db.models import TeamMembershipRow
    from backend.services.team import create_led_team

    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    team = await create_led_team(session, user)
    for i in range(5):
        m = await upsert_user_by_email(session, email=f"m{i}@example.com")
        await session.flush()
        session.add(TeamMembershipRow(team_id=team.id, user_id=m.id))  # ty: ignore[missing-argument]
    await session.commit()

    task = await row_to_contract_task(session, seeded_task_defs["T3"], caller=user)
    assert task.team_progress is not None
    assert task.team_progress.total == 6
    assert task.team_progress.cap == 6
    assert task.status == "completed"


async def test_challenge_joined_total_wins_when_higher(
    session: AsyncSession, seeded_task_defs
) -> None:
    """Spec §1.3: total = max(led_total, joined_total).

    A caller leading a 2-person team but joined to a 5-person team should
    see total=5. Regression that drops the max() and uses led_total alone
    would silently misreport challenge progress.
    """
    from backend.db.models import TeamMembershipRow
    from backend.services.team import create_led_team

    caller = await upsert_user_by_email(session, email="caller@example.com")
    other_leader = await upsert_user_by_email(session, email="leader@example.com")
    await session.flush()
    own_team = await create_led_team(session, caller)
    other_team = await create_led_team(session, other_leader)

    extra = await upsert_user_by_email(session, email="own@example.com")
    await session.flush()
    session.add(TeamMembershipRow(team_id=own_team.id, user_id=extra.id))  # ty: ignore[missing-argument]

    session.add(TeamMembershipRow(team_id=other_team.id, user_id=caller.id))  # ty: ignore[missing-argument]
    for i in range(3):
        m = await upsert_user_by_email(session, email=f"other{i}@example.com")
        await session.flush()
        session.add(TeamMembershipRow(team_id=other_team.id, user_id=m.id))  # ty: ignore[missing-argument]
    await session.commit()

    task = await row_to_contract_task(session, seeded_task_defs["T3"], caller=caller)
    assert task.team_progress is not None
    assert task.team_progress.led_total == 2
    assert task.team_progress.joined_total == 5
    assert task.team_progress.total == 5


async def test_list_caller_tasks_returns_all(
    session: AsyncSession, seeded_task_defs
) -> None:
    user = await upsert_user_by_email(session, email="jet@example.com")
    await session.flush()
    tasks = await list_caller_tasks(session, caller=user)
    assert len(tasks) == 4
    ids = {t.display_id for t in tasks}
    assert ids == {"T1", "T2", "T3", "T4"}
