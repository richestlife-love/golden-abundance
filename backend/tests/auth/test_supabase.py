"""Tests for the Supabase JWKS-based JWT verifier."""

import time
from uuid import UUID

import pytest

from backend.auth.supabase import verify_supabase_jwt
from backend.contract.auth import SupabaseClaims


def test_verify_accepts_valid_token(mint_access_token) -> None:
    user_id = UUID(int=42)
    token = mint_access_token(user_id=user_id, email="jet@example.com")

    claims = verify_supabase_jwt(token)

    assert isinstance(claims, SupabaseClaims)
    assert claims.sub == user_id
    assert claims.email == "jet@example.com"
    assert claims.aud == "authenticated"


def test_verify_rejects_expired_token(mint_access_token) -> None:
    token = mint_access_token(exp=int(time.time()) - 60)
    with pytest.raises(ValueError, match=r"(?i)expired"):
        verify_supabase_jwt(token)


def test_verify_rejects_wrong_issuer(mint_access_token) -> None:
    token = mint_access_token(iss="https://evil.example.com/auth/v1")
    with pytest.raises(ValueError, match=r"(?i)issuer"):
        verify_supabase_jwt(token)


def test_verify_rejects_wrong_audience(mint_access_token) -> None:
    token = mint_access_token(aud="service_role")
    with pytest.raises(ValueError, match=r"(?i)audience"):
        verify_supabase_jwt(token)


def test_verify_rejects_malformed_token() -> None:
    with pytest.raises(ValueError, match=r"."):
        verify_supabase_jwt("not.a.jwt")


def test_verify_rejects_alg_none() -> None:
    """Historic PyJWT vulnerability — ``alg: none`` must never be accepted."""
    import jwt as pyjwt

    forged = pyjwt.encode(
        {
            "sub": str(UUID(int=1)),
            "email": "x@x.com",
            "aud": "authenticated",
            "iss": "https://test-ref.supabase.co/auth/v1",
            "exp": 9_999_999_999,
            "iat": 0,
        },
        key="",
        algorithm="none",
    )
    with pytest.raises(ValueError, match=r"."):
        verify_supabase_jwt(forged)


def test_verify_rejects_hs256_signed_token() -> None:
    """Attacker can't downgrade RS256 → HS256 by signing with a guessed secret."""
    import jwt as pyjwt
    from jwt.warnings import InsecureKeyLengthWarning

    with pytest.warns(InsecureKeyLengthWarning):
        forged = pyjwt.encode(
            {
                "sub": str(UUID(int=1)),
                "email": "x@x.com",
                "aud": "authenticated",
                "iss": "https://test-ref.supabase.co/auth/v1",
                "exp": 9_999_999_999,
                "iat": 0,
            },
            key="guessed-secret",
            algorithm="HS256",
        )
    with pytest.raises(ValueError, match=r"."):
        verify_supabase_jwt(forged)
