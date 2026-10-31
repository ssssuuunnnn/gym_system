from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.member_segment import SegmentFilters
from app.schemas.website import _image_url


class NewsIn(BaseModel):
    """新增／編輯最新消息（ADR 0012）。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=80)
    summary: str = Field(default="", max_length=200)
    body: str = Field(default="", max_length=5000)
    image_url: str | None = None
    is_published: bool = False

    _img = field_validator("image_url", mode="before")(_image_url)


class NewsBroadcastSummary(BaseModel):
    id: int
    target_label: str
    matched_count: int
    queued_count: int
    created_by_name: str | None
    created_at: datetime


class NewsDelivery(BaseModel):
    """這則消息所有發送的結果合計（line_member_messages）。"""

    sent: int = 0
    failed: int = 0
    pending: int = 0
    skipped: int = 0


class NewsBroadcastList(BaseModel):
    delivery: NewsDelivery
    items: list[NewsBroadcastSummary]


class NewsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    summary: str
    body: str
    image_url: str | None
    is_published: bool
    published_at: datetime | None
    created_by_name: str | None
    updated_by_name: str | None
    created_at: datetime
    updated_at: datetime
    # 網站上的網址（相對路徑）
    path: str = ""
    broadcast_count: int = 0
    last_broadcast_at: datetime | None = None


class BroadcastTarget(BaseModel):
    """LINE 發送對象：會員標籤（有任一個就算）與／或會員名單條件，兩者聯集。"""

    tag_ids: list[int] = Field(default_factory=list, max_length=50)
    filters: SegmentFilters | None = None


class BroadcastPreview(BaseModel):
    # 標籤＋條件找到的會員（不含管理員與黑名單）
    total: int
    sendable: int
    no_line: int
    no_consent: int
    # 這則消息之前已經發給其中幾位（不會重複發）
    already_sent: int
    # 這次實際會發的人數
    to_send: int
    oa_enabled: bool
    website_published: bool
    problems: list[str]


class BroadcastResult(BaseModel):
    broadcast_id: int
    queued: int
