"""News feed. pinned first, then by published_at desc, then id desc.

Keyset pagination is delegated to ``services.pagination.paginate_keyset``
— it composes a ``tuple_(...) < tuple_(...)`` WHERE from the declared
``sort`` spec, so the filter and the cursor encoding can't drift apart.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.contract import NewsItem as ContractNewsItem
from backend.contract import Paginated
from backend.db.models import NewsItemRow
from backend.services.pagination import SortCol, paginate_keyset


def row_to_contract_news(row: NewsItemRow) -> ContractNewsItem:
    return ContractNewsItem(
        id=row.id,
        title=row.title,
        body=row.body,
        category=row.category,
        image_url=row.image_url,
        published_at=row.published_at,
        pinned=row.pinned,
    )


async def list_news(session: AsyncSession, *, cursor: str | None, limit: int) -> Paginated[ContractNewsItem]:
    stmt = select(NewsItemRow)
    page, next_cursor = await paginate_keyset(
        session,
        stmt,
        sort=[
            SortCol(NewsItemRow.pinned, to_json=bool, from_json=bool),
            SortCol(
                NewsItemRow.published_at,
                to_json=lambda d: d.isoformat(),
                from_json=datetime.fromisoformat,
            ),
            SortCol(NewsItemRow.id, to_json=str, from_json=UUID),
        ],
        cursor=cursor,
        limit=limit,
        extract=lambda r: (r[0].pinned, r[0].published_at, r[0].id),
    )
    return Paginated[ContractNewsItem](
        items=[row_to_contract_news(r[0]) for r in page],
        next_cursor=next_cursor,
    )
