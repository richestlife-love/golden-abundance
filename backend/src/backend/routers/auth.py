"""Auth endpoints: POST /auth/google (sign-in/sign-up) and
POST /auth/logout (best-effort; tokens expire naturally)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import current_user
from backend.auth.google_stub import verify_id_token
from backend.auth.jwt import encode_token
from backend.config import get_settings
from backend.contract import AuthResponse, GoogleAuthRequest
from backend.db.models import UserRow
from backend.db.session import get_session
from backend.services.user import row_to_contract_user, upsert_user_by_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/google", response_model=AuthResponse)
async def sign_in_with_google(
    body: GoogleAuthRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    try:
        email = verify_id_token(body.id_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = await upsert_user_by_email(session, email=email)
    await session.commit()
    # No refresh needed: the sessionmaker is bound with expire_on_commit=False
    # (see backend/db/engine.py) so `user` keeps its post-flush attributes.
    token = encode_token(user_id=user.id, email=user.email)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        expires_in=get_settings().jwt_ttl_seconds,
        user=row_to_contract_user(user),
        profile_complete=user.profile_complete,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(_: UserRow = Depends(current_user)) -> None:
    """No server-side revocation in Phase 5; tokens expire naturally.
    Endpoint exists so the frontend can drop its token on a successful
    200/204 and know the caller's identity was valid at sign-out time."""
