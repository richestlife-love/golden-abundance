import pytest

from backend.auth.google_stub import verify_id_token


def test_stub_treats_id_token_as_email() -> None:
    assert verify_id_token("jet@example.com") == "jet@example.com"


def test_stub_rejects_empty_token() -> None:
    with pytest.raises(ValueError):
        verify_id_token("")


def test_stub_rejects_non_email_shape() -> None:
    with pytest.raises(ValueError):
        verify_id_token("not-an-email")
