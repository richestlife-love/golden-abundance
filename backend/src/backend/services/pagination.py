"""Keyset pagination helpers.

Cursor format is a URL-safe base64 of a JSON list — one entry per sort
column, in the order the caller declared. Clients treat it as opaque.

`paginate_keyset` is the actual paginator: it applies the ORDER BY, adds
the tuple-comparison WHERE that filters strictly past the cursor,
fetches one extra row to detect more pages, and builds the next cursor
from the last-returned row's sort-column values. The filter and encoder
share one `sort` spec, so the "decoded-but-unused sort key" bug class is
eliminated by construction.

Constraint: every sort column must have the same direction — Phase-5
paginators are all DESC. Mixed directions need an OR-expansion of the
cursor predicate which this helper doesn't implement.

Malformed cursors raise `InvalidCursorError`; `backend.server.create_app()`
registers a global handler that turns those into HTTP 400.
"""

import base64
import json
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import ColumnElement, Row, Select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession


class InvalidCursorError(ValueError):
    """Malformed or tampered cursor. The global exception handler in
    `backend.server.create_app()` translates this into HTTP 400."""


@dataclass(frozen=True)
class SortCol:
    """One column in a paginator's sort tuple.

    `to_json` / `from_json` convert between the DB value and its
    JSON-serializable form in the cursor payload. Defaults suit str
    (e.g. an already-serialized id); UUID / datetime columns must
    override — see the call sites in `services/team.py` and
    `services/news.py`.
    """

    col: ColumnElement[Any]
    to_json: Callable[[Any], Any] = str
    from_json: Callable[[Any], Any] = field(default=lambda v: v)


def encode_cursor(payload: Any) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(cursor: str) -> Any:
    pad = "=" * (-len(cursor) % 4)
    try:
        raw = base64.urlsafe_b64decode(cursor + pad)
        return json.loads(raw)
    except (ValueError, json.JSONDecodeError) as exc:
        raise InvalidCursorError("Invalid cursor") from exc


async def paginate_keyset(
    session: AsyncSession,
    stmt: Select[Any],
    *,
    sort: Sequence[SortCol],
    cursor: str | None,
    limit: int,
    extract: Callable[[Row[Any]], Sequence[Any]],
) -> tuple[list[Row[Any]], str | None]:
    """Apply DESC-keyset pagination to ``stmt`` over ``sort``.

    ``extract`` pulls the sort-column values out of one fetched row in
    the same order as ``sort`` — e.g. ``lambda r: (r[0].created_at,
    r[0].id)`` for a two-entity ``select(A, B)`` statement.

    Returns ``(page_rows, next_cursor)``. ``next_cursor`` is None on the
    last page. Raises ``InvalidCursorError`` on malformed input or
    cursor-shape mismatch.
    """
    if cursor is not None:
        payload = decode_cursor(cursor)
        if not isinstance(payload, list) or len(payload) != len(sort):
            raise InvalidCursorError("cursor shape does not match sort columns")
        values = [s.from_json(payload[i]) for i, s in enumerate(sort)]
        stmt = stmt.where(tuple_(*(s.col for s in sort)) < tuple_(*values))
    stmt = stmt.order_by(*(s.col.desc() for s in sort)).limit(limit + 1)

    rows = (await session.execute(stmt)).all()
    page = list(rows[:limit])
    next_cursor: str | None = None
    if len(rows) > limit and page:
        last_values = extract(page[-1])
        next_cursor = encode_cursor([s.to_json(v) for s, v in zip(sort, last_values, strict=True)])
    return page, next_cursor
