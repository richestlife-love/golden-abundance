"""News feed shapes. `category` drives the badge colour client-side;
the mapping lives in `frontend/app.jsx` NewsBoard."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NewsItem(BaseModel):
    """A single entry in the home-screen news carousel."""
    model_config = ConfigDict(extra="forbid")

    id: UUID
    title: str
    body: str
    category: Literal["公告", "活動", "通知"]
    image_url: str | None = None
    published_at: datetime
    pinned: bool = False
