"""Idempotent dev seed. Creates task definitions (T1-T4), a few news
items, and the six @demo.ga demo users. Each demo user is keyed by a
stable ``UUID(int=N)`` so re-running this script after a migration
preserves row identity. Real users flow through ``current_user`` and
upsert themselves on first authed request; the dev seed only bootstraps
fixtures.

Run with: `just -f backend/justfile seed` (after `just db-up` + `just migrate`).
Running sequentially twice is safe — existing rows (by display_id / title /
email) are skipped. Concurrent invocations are not coordinated; one may lose
on the unique constraint, which is acceptable for a dev seed.
"""

import asyncio
from datetime import UTC, datetime, timedelta
from typing import NotRequired, TypedDict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.db.engine import get_session_maker
from backend.db.models import (
    JoinRequestRow,
    NewsItemRow,
    TaskDefRequiresRow,
    TaskDefRow,
    TaskStepDefRow,
    TeamRow,
    UserRow,
)
from backend.services.team import create_led_team
from backend.services.team_join import JoinConflictError, create_join_request
from backend.services.user import upsert_user_by_supabase_identity


class _DemoUser(TypedDict):
    user_id: UUID
    email: str
    zh_name: str
    en_name: NotRequired[str]
    nickname: NotRequired[str]
    phone: str
    phone_code: str
    line_id: NotRequired[str]
    telegram_id: NotRequired[str]
    country: str
    location: str


DEMO_USERS: list[_DemoUser] = [
    {
        "user_id": UUID(int=1),
        "email": "jet@demo.ga",
        "zh_name": "金杰",
        "en_name": "Jet Kan",
        "nickname": "Jet",
        "phone": "912345678",
        "phone_code": "+886",
        "country": "TW",
        "location": "台北",
    },
    {
        "user_id": UUID(int=2),
        "email": "ami@demo.ga",
        "zh_name": "林詠瑜",
        "en_name": "Ami Lin",
        "nickname": "Ami",
        "phone": "912345679",
        "phone_code": "+886",
        "country": "TW",
        "location": "台北",
    },
    {
        "user_id": UUID(int=3),
        "email": "alex@demo.ga",
        "zh_name": "陳志豪",
        "en_name": "Alex Chen",
        "nickname": "Alex",
        "phone": "912345680",
        "phone_code": "+886",
        "country": "TW",
        "location": "新北",
    },
    {
        "user_id": UUID(int=4),
        "email": "mei@demo.ga",
        "zh_name": "王美玲",
        "en_name": "Mei Wang",
        "nickname": "Mei",
        "phone": "912345681",
        "phone_code": "+886",
        "country": "TW",
        "location": "台中",
    },
    {
        "user_id": UUID(int=5),
        "email": "kai@demo.ga",
        "zh_name": "黃凱文",
        "en_name": "Kai Huang",
        "nickname": "Kai",
        "phone": "912345682",
        "phone_code": "+886",
        "country": "TW",
        "location": "高雄",
    },
    {
        "user_id": UUID(int=6),
        "email": "yu@demo.ga",
        "zh_name": "張詩宇",
        "en_name": "Yu Chang",
        "nickname": "Yu",
        "phone": "912345683",
        "phone_code": "+886",
        "country": "TW",
        "location": "台南",
    },
]

# gamma-with-two-leaders fan-out: two pending requests each at jet and ami teams.
# Exercises leader-approval UX (team-detail pending list) for Phase 4 plumbing.
DEMO_FANOUT: list[tuple[str, str]] = [
    ("alex@demo.ga", "jet@demo.ga"),
    ("mei@demo.ga", "jet@demo.ga"),
    ("kai@demo.ga", "ami@demo.ga"),
    ("yu@demo.ga", "ami@demo.ga"),
]


# Shared prototype task definitions. Consumed by the seed script here
# and by ``tests/conftest.py::seeded_task_defs`` so the two sources of
# truth don't drift. Keyed by display_id; values spread directly into
# the ``TaskDefRow`` constructor.
PROTOTYPE_TASK_DEFS: dict[str, dict[str, object]] = {
    "T1": {
        "title": "填寫金富有志工表單",
        "summary": "完成你的志工個人資料，開啟金富有志工旅程。",
        "description": "歡迎加入金富有志工！請填寫基本個人資料。",
        "tag": "探索",
        "color": "#fec701",
        "points": 50,
        "bonus": None,
        "est_minutes": 5,
        "is_challenge": False,
        "form_type": "interest",
    },
    "T2": {
        "title": "夏季盛會報名",
        "summary": "報名 5/10 夏季盛會。",
        "description": "請選擇 725/726 場次票券。",
        "tag": "社区",
        "color": "#38b6ff",
        "points": 80,
        "bonus": "限定紀念徽章",
        "est_minutes": 10,
        "is_challenge": False,
        "form_type": "ticket",
    },
    "T3": {
        "title": "組成 6 人團隊",
        "summary": "揪齊 6 位夥伴組團衝榜。",
        "description": "當你的領團或加入團總人數達 6 人，任務自動完成。",
        "tag": "陪伴",
        "color": "#ff5c8a",
        "points": 120,
        "bonus": None,
        "est_minutes": 0,
        "is_challenge": True,
        "cap": 6,
        "form_type": None,
    },
    "T4": {
        "title": "志工培訓 (已結束)",
        "summary": "2026 春季培訓。",
        "description": "已結束,僅供參考。",
        "tag": "探索",
        "color": "#a3a3a3",
        "points": 0,
        "bonus": None,
        "est_minutes": 60,
        "is_challenge": False,
        "form_type": None,
        "due_at": datetime(2026, 3, 1, tzinfo=UTC),
    },
}

T1_STEP_LABELS = ("確認電子郵件與手機", "填寫個人興趣與專長", "選擇可投入的時段", "簽署志工服務同意書")


async def _upsert_task_defs(session: AsyncSession) -> dict[str, TaskDefRow]:
    existing = {t.display_id: t for t in (await session.execute(select(TaskDefRow))).scalars().all()}

    if "T1" not in existing:
        t1 = TaskDefRow(display_id="T1", **PROTOTYPE_TASK_DEFS["T1"])
        session.add(t1)
        await session.flush()
        for order, label in enumerate(T1_STEP_LABELS, start=1):
            session.add(TaskStepDefRow(task_def_id=t1.id, label=label, order=order))
        existing["T1"] = t1

    if "T2" not in existing:
        t2 = TaskDefRow(display_id="T2", **PROTOTYPE_TASK_DEFS["T2"])
        session.add(t2)
        await session.flush()
        existing["T2"] = t2
        # T2 requires T1
        session.add(TaskDefRequiresRow(task_def_id=t2.id, requires_id=existing["T1"].id))

    if "T3" not in existing:
        t3 = TaskDefRow(display_id="T3", **PROTOTYPE_TASK_DEFS["T3"])
        session.add(t3)
        existing["T3"] = t3

    if "T4" not in existing:
        t4 = TaskDefRow(display_id="T4", **PROTOTYPE_TASK_DEFS["T4"])
        session.add(t4)
        existing["T4"] = t4

    await session.flush()
    return existing


async def _upsert_news(session: AsyncSession) -> None:
    existing = {n.title for n in (await session.execute(select(NewsItemRow))).scalars().all()}
    _now = datetime.now(tz=UTC)
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
                category=category,
                pinned=pinned,
                published_at=_now - timedelta(days=offset_days),
            ),
        )
    await session.flush()


async def _upsert_demo_users(session: AsyncSession) -> dict[str, UserRow]:
    """Seed the six @demo.ga demo users via the real sign-in flow.

    Idempotent: existing rows (by email) are skipped; returns a dict
    of ``{email: UserRow}`` spanning both pre-existing and newly
    created demo users. Mirrors ``routers/me.py::complete_profile`` —
    flips ``profile_complete=True`` and calls ``create_led_team`` in
    the same transaction so each demo user has a led team ready for
    downstream A2 fan-out.
    """
    existing = {
        u.email: u for u in (await session.execute(select(UserRow))).scalars().all() if u.email.endswith("@demo.ga")
    }
    out: dict[str, UserRow] = dict(existing)
    for spec in DEMO_USERS:
        if spec["email"] in existing:
            continue
        user = await upsert_user_by_supabase_identity(
            session,
            auth_user_id=spec["user_id"],
            email=spec["email"],
        )
        user.zh_name = spec["zh_name"]
        user.en_name = spec.get("en_name")
        user.nickname = spec.get("nickname")
        user.phone = spec["phone"]
        user.phone_code = spec["phone_code"]
        user.line_id = spec.get("line_id")
        user.telegram_id = spec.get("telegram_id")
        user.country = spec["country"]
        user.location = spec["location"]
        user.profile_complete = True
        session.add(user)
        await session.flush()
        await create_led_team(session, user)
        out[spec["email"]] = user
    await session.flush()
    return out


async def _upsert_demo_join_requests(session: AsyncSession, users: dict[str, UserRow]) -> None:
    """Seed the gamma-with-two-leaders pending join requests.

    Idempotent: any requester with a pre-existing pending request
    anywhere is skipped (Phase 5c invariant: at-most-one-pending-per-user).
    ``create_join_request`` re-enforces the invariant and raises
    ``JoinConflictError`` if violated — we wrap it defensively so a
    partial-seed replay can't abort the whole run.
    """
    teams_by_leader: dict[UUID, TeamRow] = {
        t.leader_id: t for t in (await session.execute(select(TeamRow))).scalars().all()
    }
    existing_pending_by_user: dict[UUID, list[JoinRequestRow]] = {}
    for req in (
        (await session.execute(select(JoinRequestRow).where(JoinRequestRow.status == "pending"))).scalars().all()
    ):
        existing_pending_by_user.setdefault(req.user_id, []).append(req)

    for requester_email, leader_email in DEMO_FANOUT:
        requester = users.get(requester_email)
        leader = users.get(leader_email)
        if requester is None or leader is None:
            continue
        if existing_pending_by_user.get(requester.id):
            continue
        team = teams_by_leader.get(leader.id)
        if team is None:
            continue
        try:
            await create_join_request(session, team=team, requester=requester)
        except JoinConflictError:
            continue
    await session.flush()


async def run() -> None:
    # get_session_maker() resolves lazily against whatever engine
    # backend.db.engine is currently bound to (production by default;
    # the pytest harness rebinds via DATABASE_URL env + cache-clear
    # before calling this).
    #
    # Task defs and news are real content and seed in any env. Demo
    # users (@demo.ga) and their pre-canned join requests only belong
    # in dev/test — a `just seed` against prod must never create them.
    is_prod = get_settings().app_env == "prod"
    async with get_session_maker()() as session:
        await _upsert_task_defs(session)
        await _upsert_news(session)
        if not is_prod:
            users = await _upsert_demo_users(session)
            await _upsert_demo_join_requests(session, users)
        await session.commit()
    print("seed: done")


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(run())
