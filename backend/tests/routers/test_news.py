from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import NewsItemRow
from tests.helpers import sign_in, sign_in_and_complete


async def _seed(session: AsyncSession) -> list[NewsItemRow]:
    items = [
        NewsItemRow(
            title="A-pin",
            body="...",
            category="公告",
            pinned=True,
            published_at=datetime(2026, 4, 18, tzinfo=UTC),
        ),
        NewsItemRow(
            title="B",
            body="...",
            category="活動",
            pinned=False,
            published_at=datetime(2026, 4, 17, tzinfo=UTC),
        ),
        NewsItemRow(
            title="C",
            body="...",
            category="通知",
            pinned=False,
            published_at=datetime(2026, 4, 16, tzinfo=UTC),
        ),
    ]
    for item in items:
        session.add(item)
    await session.commit()
    return items


async def test_news_pinned_first(client: AsyncClient, session: AsyncSession) -> None:
    await _seed(session)
    h = await sign_in(client, "jet@example.com")
    response = await client.get("/api/v1/news", headers=h)
    assert response.status_code == 200
    items = response.json()["items"]
    assert items[0]["title"] == "A-pin"
    assert items[0]["pinned"] is True
    assert [it["title"] for it in items[1:3]] == ["B", "C"]


async def test_news_cursor_pagination(client: AsyncClient, session: AsyncSession) -> None:
    await _seed(session)
    h = await sign_in(client, "jet@example.com")
    first = await client.get("/api/v1/news?limit=2", headers=h)
    data = first.json()
    assert len(data["items"]) == 2
    assert data["next_cursor"] is not None

    second = await client.get(f"/api/v1/news?limit=2&cursor={data['next_cursor']}", headers=h)
    assert second.status_code == 200
    tail = second.json()["items"]
    assert [it["title"] for it in tail] == ["C"]


async def test_news_over_max_limit_422(client: AsyncClient) -> None:
    h = await sign_in(client, "jet@example.com")
    response = await client.get("/api/v1/news?limit=101", headers=h)
    assert response.status_code == 422


async def test_news_garbage_cursor_returns_400(client: AsyncClient) -> None:
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.get("/api/v1/news?cursor=not-a-real-cursor", headers=jet.headers)
    assert r.status_code == 400


async def test_news_empty_returns_empty_items(client: AsyncClient) -> None:
    """Empty news table: 200 with items=[] and next_cursor=null."""
    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    r = await client.get("/api/v1/news", headers=jet.headers)
    assert r.status_code == 200
    data = r.json()
    assert data["items"] == []
    assert data["next_cursor"] is None


async def test_news_multiple_pinned_sort_by_published_at_desc(
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    """Spec §Content: news sort is ``pinned DESC, published_at DESC``.
    Two pinned items must order newer-first among themselves, and a
    newer unpinned item must still fall below both.
    """
    session.add(
        NewsItemRow(
            title="pin-older",
            body="...",
            category="公告",
            pinned=True,
            published_at=datetime(2026, 4, 10, tzinfo=UTC),
        ),
    )
    session.add(
        NewsItemRow(
            title="pin-newer",
            body="...",
            category="公告",
            pinned=True,
            published_at=datetime(2026, 4, 18, tzinfo=UTC),
        ),
    )
    session.add(
        NewsItemRow(
            title="unpinned-newest",
            body="...",
            category="活動",
            pinned=False,
            published_at=datetime(2026, 4, 20, tzinfo=UTC),
        ),
    )
    await session.commit()

    h = await sign_in(client, "jet@example.com")
    items = (await client.get("/api/v1/news", headers=h)).json()["items"]
    assert [it["title"] for it in items] == ["pin-newer", "pin-older", "unpinned-newest"]


async def test_news_cursor_terminal_page_next_cursor_is_none(client: AsyncClient, session: AsyncSession) -> None:
    """On the last page, next_cursor must be null."""
    from backend.db.models import NewsItemRow

    jet = await sign_in_and_complete(client, "jet@example.com", "簡傑特")
    for i in range(3):
        session.add(
            NewsItemRow(
                title=f"News {i}",
                body=f"body {i}",
                pinned=False,
                category="活動",
                published_at=datetime(2026, 4, 10 + i, tzinfo=UTC),
            ),
        )
    await session.commit()

    first = (await client.get("/api/v1/news?limit=2", headers=jet.headers)).json()
    assert len(first["items"]) == 2
    assert first["next_cursor"] is not None

    second = (
        await client.get(
            f"/api/v1/news?limit=2&cursor={first['next_cursor']}",
            headers=jet.headers,
        )
    ).json()
    assert len(second["items"]) == 1
    assert second["next_cursor"] is None
