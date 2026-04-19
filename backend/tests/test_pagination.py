import pytest

from backend.services.pagination import InvalidCursor, decode_cursor, encode_cursor


def test_cursor_round_trip_dict() -> None:
    payload = {"id": "7f7a9b10-1d3a-4c2e-9e81-1b3e8a2d0001", "sort": "2026-04-01T10:30:00Z"}
    assert decode_cursor(encode_cursor(payload)) == payload


def test_cursor_round_trip_list() -> None:
    # New shape: paginate_keyset encodes a positional list, one entry per SortCol.
    payload = ["2026-04-01T10:30:00+00:00", "7f7a9b10-1d3a-4c2e-9e81-1b3e8a2d0001"]
    assert decode_cursor(encode_cursor(payload)) == payload


def test_decode_rejects_garbage() -> None:
    with pytest.raises(InvalidCursor):
        decode_cursor("not-valid-base64-..-!!!")


def test_invalid_cursor_is_value_error_subclass() -> None:
    # Lets callers that only care about "malformed cursor" catch ValueError
    # without importing InvalidCursor.
    assert issubclass(InvalidCursor, ValueError)
