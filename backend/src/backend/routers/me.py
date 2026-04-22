"""Me endpoints: GET /me, POST /me/profile, PATCH /me.

POST /me/profile is idempotent only in the failing sense: a completed
profile returns 409. This matches spec §1.2 (one-shot completion).
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.contract import (
    MeProfileCreateResponse,
    MeTeamsResponse,
    ProfileCreate,
    ProfileUpdate,
)
from backend.contract import (
    Reward as ContractReward,
)
from backend.contract import (
    Task as ContractTask,
)
from backend.contract import (
    User as ContractUser,
)
from backend.db.models import TeamMembershipRow, TeamRow, UserRow
from backend.db.session import get_session
from backend.rate_limit import limiter
from backend.services.reward import list_rewards_for
from backend.services.task import list_caller_tasks
from backend.services.team import create_led_team, row_to_contract_team
from backend.services.user import row_to_contract_user

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=ContractUser)
async def get_me(me: UserRow = Depends(current_user)) -> ContractUser:
    return row_to_contract_user(me)


@router.post("/profile", response_model=MeProfileCreateResponse)
@limiter.limit("10/minute")
async def complete_profile(
    request: Request,
    body: ProfileCreate,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MeProfileCreateResponse:
    if me.profile_complete:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile already complete",
        )
    # Atomic: all profile fields + flag + led team, single commit.
    me.zh_name = body.zh_name
    me.en_name = body.en_name
    me.nickname = body.nickname
    me.phone = body.phone
    me.phone_code = body.phone_code
    me.line_id = body.line_id
    me.telegram_id = body.telegram_id
    me.country = body.country
    me.location = body.location
    me.profile_complete = True
    await session.flush()

    team = await create_led_team(session, me)
    await session.commit()

    return MeProfileCreateResponse(
        user=row_to_contract_user(me),
        led_team=await row_to_contract_team(session, team, caller_id=me.id),
    )


@router.patch("", response_model=ContractUser)
async def patch_me(
    body: ProfileUpdate,
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ContractUser:
    # ``ProfileUpdate`` inherits ``StrictModel(extra='forbid')`` — the
    # field set is closed and ``id`` / ``display_id`` / ``profile_complete``
    # cannot be smuggled in from the wire.
    for field_name in body.model_fields_set:
        setattr(me, field_name, getattr(body, field_name))
    await session.commit()
    return row_to_contract_user(me)


@router.get("/teams", response_model=MeTeamsResponse)
async def get_me_teams(
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MeTeamsResponse:
    led_row = (await session.execute(select(TeamRow).where(TeamRow.leader_id == me.id))).scalar_one_or_none()
    joined_row = None
    joined_link = (
        await session.execute(select(TeamMembershipRow).where(TeamMembershipRow.user_id == me.id))
    ).scalar_one_or_none()
    if joined_link is not None:
        joined_row = await session.get(TeamRow, joined_link.team_id)

    return MeTeamsResponse(
        led=await row_to_contract_team(session, led_row, caller_id=me.id) if led_row else None,
        joined=(await row_to_contract_team(session, joined_row, caller_id=me.id) if joined_row else None),
    )


@router.get("/tasks", response_model=list[ContractTask])
async def get_me_tasks(
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ContractTask]:
    return await list_caller_tasks(session, caller=me)


@router.get("/rewards", response_model=list[ContractReward])
async def get_me_rewards(
    me: UserRow = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ContractReward]:
    return await list_rewards_for(session, me)
