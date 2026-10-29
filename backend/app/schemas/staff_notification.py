from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.staff_notification import StaffNotificationKind


class StaffNotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: StaffNotificationKind
    title: str
    body: str
    link: str
    read_at: datetime | None
    created_at: datetime


class StaffNotificationPage(BaseModel):
    items: list[StaffNotificationOut]
    # 還有更早的通知（用最後一筆的 id 當 before_id 繼續載入）
    has_more: bool


class StaffNotificationSummary(BaseModel):
    unread_count: int
    # 最新一筆通知的 id；前端下次輪詢帶 after_id，只拿這之後的新通知來跳 toast
    latest_id: int
    # after_id 之後的新通知（最多 10 筆，新到舊）；沒帶 after_id 時為空
    new: list[StaffNotificationOut]
