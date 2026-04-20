"""Idempotent dev seed. Creates task definitions (T1-T4), a few
news items, and nothing else. Users sign in via /auth/google and
complete their own profile + team.

Run with: `just -f backend/justfile seed` (after `just db-up` + `just migrate`).
Running sequentially twice is safe — existing rows (by display_id / title) are skipped.
Concurrent invocations are not coordinated; one may lose on the unique constraint,
which is acceptable for a dev seed.
"""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.engine import get_session_maker
from backend.db.models import (
    NewsItemRow,
    TaskDefRequiresRow,
    TaskDefRow,
    TaskStepDefRow,
)


async def _upsert_task_defs(session: AsyncSession) -> dict[str, TaskDefRow]:
    existing = {t.display_id: t for t in (await session.execute(select(TaskDefRow))).scalars().all()}

    if "T1" not in existing:
        t1 = TaskDefRow(  # ty: ignore[missing-argument]
            display_id="T1",
            title="填寫金富有志工表單",
            summary="完成你的志工個人資料，開啟金富有志工旅程。",
            description="歡迎加入金富有志工！請填寫基本個人資料。",
            tag="探索",
            color="#fec701",
            points=50,
            bonus=None,
            est_minutes=5,
            is_challenge=False,
            form_type="interest",
        )
        session.add(t1)
        await session.flush()
        for order, label in enumerate(
            ["確認電子郵件與手機", "填寫個人興趣與專長", "選擇可投入的時段", "簽署志工服務同意書"],
            start=1,
        ):
            session.add(TaskStepDefRow(task_def_id=t1.id, label=label, order=order))
        existing["T1"] = t1

    if "T2" not in existing:
        t2 = TaskDefRow(  # ty: ignore[missing-argument]
            display_id="T2",
            title="夏季盛會報名",
            summary="報名 5/10 夏季盛會。",
            description="請選擇 725/726 場次票券。",
            tag="社区",
            color="#38b6ff",
            points=80,
            bonus="限定紀念徽章",
            est_minutes=10,
            is_challenge=False,
            form_type="ticket",
        )
        session.add(t2)
        await session.flush()
        existing["T2"] = t2
        # T2 requires T1
        session.add(TaskDefRequiresRow(task_def_id=t2.id, requires_id=existing["T1"].id))

    if "T3" not in existing:
        t3 = TaskDefRow(  # ty: ignore[missing-argument]
            display_id="T3",
            title="組成 6 人團隊",
            summary="揪齊 6 位夥伴組團衝榜。",
            description="當你的領團或加入團總人數達 6 人，任務自動完成。",
            tag="陪伴",
            color="#ff5c8a",
            points=120,
            bonus=None,
            est_minutes=0,
            is_challenge=True,
            cap=6,
            form_type=None,
        )
        session.add(t3)
        existing["T3"] = t3

    if "T4" not in existing:
        t4 = TaskDefRow(  # ty: ignore[missing-argument]
            display_id="T4",
            title="志工培訓 (已結束)",
            summary="2026 春季培訓。",
            description="已結束，僅供參考。",
            tag="探索",
            color="#a3a3a3",
            points=0,
            bonus=None,
            est_minutes=60,
            is_challenge=False,
            form_type=None,
            due_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        )
        session.add(t4)
        existing["T4"] = t4

    await session.flush()
    return existing


async def _upsert_news(session: AsyncSession) -> None:
    existing = {n.title for n in (await session.execute(select(NewsItemRow))).scalars().all()}
    _now = datetime.now(tz=timezone.utc)
    # News items: (title, body, category, pinned, offset_days)
    seeds = [
        ("夏季盛會志工招募開跑", "5/10 夏季盛會報名中。", "公告", True, 1),
        ("本月星點雙倍週即將開始", "4/22–28 任務星點 ×2。", "活動", False, 3),
        ("新任務「長者陪伴」已上線", "每週六下午可獲得 120 星點。", "通知", False, 5),
    ]
    for title, body, category, pinned, offset_days in seeds:
        if title in existing:
            continue
        session.add(
            NewsItemRow(
                title=title,
                body=body,
                category=category,  # ty: ignore[invalid-argument-type]
                pinned=pinned,
                published_at=_now - timedelta(days=offset_days),
            )
        )
    await session.flush()


async def run() -> None:
    # get_session_maker() resolves lazily against whatever engine
    # backend.db.engine is currently bound to (production by default;
    # the pytest harness rebinds via DATABASE_URL env + cache-clear
    # before calling this).
    async with get_session_maker()() as session:
        await _upsert_task_defs(session)
        await _upsert_news(session)
        await session.commit()
    print("seed: done")


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(run())
