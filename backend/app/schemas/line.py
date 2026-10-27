from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class LineRecipientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    notify_inquiry: bool
    notify_payment: bool
    notify_booking: bool
    bound_by_name: str | None
    created_at: datetime


class LineRecipientUpdate(BaseModel):
    notify_inquiry: bool | None = None
    notify_payment: bool | None = None
    notify_booking: bool | None = None


class LineSettingsOut(BaseModel):
    """後台「系統設定 › LINE 通知」需要的全部資料。"""

    configured: bool
    bot_name: str
    add_friend_url: str | None
    month_sent: int
    monthly_cap: int
    recipients: list[LineRecipientOut]


class LineBindCodeOut(BaseModel):
    id: int
    code: str
    expires_at: datetime
    add_friend_url: str | None


class LineBindStatusOut(BaseModel):
    status: Literal["waiting", "bound", "expired"]
    recipient: LineRecipientOut | None = None


class LineTestOut(BaseModel):
    queued: bool
