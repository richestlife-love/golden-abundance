"""Async SQLAlchemy engine + session factory.

Engine and sessionmaker are built lazily inside ``get_engine()`` /
``get_session_maker()``. This lets test harnesses swap ``DATABASE_URL``
(or install a pre-built engine via ``reset_engine()``) before any code
opens a session — no module-import ordering hazard.

App code should prefer the getters::

    from backend.db.engine import get_session_maker
    async with get_session_maker()() as session: ...

The legacy module attributes ``engine`` and ``AsyncSessionLocal`` are
still accessible for ergonomics; both resolve through the same lazy
singletons via ``__getattr__``.
"""

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.config import get_settings

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            get_settings().database_url,
            echo=False,
            future=True,
            pool_pre_ping=True,
        )
    return _engine


def get_session_maker() -> async_sessionmaker[AsyncSession]:
    global _sessionmaker
    if _sessionmaker is None:
        _sessionmaker = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _sessionmaker


def reset_engine(engine: AsyncEngine) -> None:
    """Install a pre-built engine and rebuild the sessionmaker against it.

    Used by the pytest harness to pin the engine to a testcontainer.
    Call BEFORE any code opens a session; sessions produced by the
    previous sessionmaker keep their binding to the previous engine.
    """
    global _engine, _sessionmaker
    _engine = engine
    _sessionmaker = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def __getattr__(name: str):  # pragma: no cover - trivial lazy loader
    if name == "engine":
        return get_engine()
    if name == "AsyncSessionLocal":
        return get_session_maker()
    raise AttributeError(f"module 'backend.db.engine' has no attribute {name!r}")
