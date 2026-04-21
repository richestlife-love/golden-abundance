"""Tests for the SupabaseClaims contract model."""

from uuid import UUID

import pytest
from pydantic import ValidationError

from backend.contract.auth import SupabaseClaims


def test_claims_round_trip() -> None:
    raw = {
        "sub": "11111111-2222-3333-4444-555555555555",
        "email": "jet@example.com",
        "aud": "authenticated",
        "exp": 1_800_000_000,
        "iat": 1_700_000_000,
        "role": "authenticated",
    }
    claims = SupabaseClaims.model_validate(raw)
    assert claims.sub == UUID("11111111-2222-3333-4444-555555555555")
    assert claims.email == "jet@example.com"
    assert claims.aud == "authenticated"


def test_claims_rejects_non_uuid_sub() -> None:
    raw = {
        "sub": "not-a-uuid",
        "email": "e@x.com",
        "aud": "authenticated",
        "exp": 1_800_000_000,
        "iat": 1_700_000_000,
    }
    with pytest.raises(ValidationError):
        SupabaseClaims.model_validate(raw)


def test_claims_rejects_missing_email() -> None:
    raw = {
        "sub": "11111111-2222-3333-4444-555555555555",
        "aud": "authenticated",
        "exp": 1_800_000_000,
        "iat": 1_700_000_000,
    }
    with pytest.raises(ValidationError):
        SupabaseClaims.model_validate(raw)


def test_claims_ignores_unknown_keys() -> None:
    """Supabase adds user_metadata / app_metadata / role — we don't care about any of those."""
    raw = {
        "sub": "11111111-2222-3333-4444-555555555555",
        "email": "e@x.com",
        "aud": "authenticated",
        "exp": 1_800_000_000,
        "iat": 1_700_000_000,
        "user_metadata": {"full_name": "Anything"},
        "app_metadata": {"provider": "google"},
    }
    claims = SupabaseClaims.model_validate(raw)
    assert claims.sub == UUID("11111111-2222-3333-4444-555555555555")
