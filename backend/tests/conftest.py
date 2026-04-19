"""Shared pytest fixtures. Section B adds DB/container fixtures."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from backend.server import create_app


@pytest.fixture
def no_db_client() -> Iterator[TestClient]:
    """Sync TestClient without DB — for routes that don't touch the database."""
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app()
    with TestClient(app) as c:
        yield c
