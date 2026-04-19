"""DB layer: async engine, session factory, SQLModel tables.

Tables are the persistence shape. The wire-format contract lives in
`backend.contract`; services translate between the two.
"""

from backend.db.engine import get_engine, get_session_maker
from backend.db.session import get_session

__all__ = ["get_engine", "get_session", "get_session_maker"]
