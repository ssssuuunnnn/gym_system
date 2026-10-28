from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.user import Token


class LineOaOut(BaseModel):
    """系統設定 › LINE 官方帳號。金鑰只回傳末四碼。"""

    configured: bool
    enabled: bool
    login_channel_id: str | None = None
    liff_id: str | None = None
    channel_secret_hint: str | None = None
    access_token_hint: str | None = None
    bot_basic_id: str | None = None
    bot_name: str | None = None
    bot_picture_url: str | None = None
    rich_menu_set: bool = False
    verified_at: datetime | None = None
    last_error: str | None = None
    updated_by_name: str | None = None
    updated_at: datetime | None = None
    # 要填到 LINE Developers 的值
    webhook_url: str
    liff_endpoint_url: str
    # 啟用後：會員入口與加好友網址
    liff_url: str | None = None
    add_friend_url: str | None = None
    linked_members: int = 0
    # 會員通知（第二階段）
    notify_booking_result: bool = True
    notify_booking_cancel: bool = True
    notify_payment_confirmed: bool = True
    notify_class_reminder: bool = True
    reminder_hour: int = 20
    member_monthly_cap: int | None = None
    member_sent_this_month: int = 0


class LineOaUpdate(BaseModel):
    """第一次設定必須三個金鑰都填；之後 secret／token 留空表示不變。"""

    channel_secret: str | None = Field(default=None, max_length=100)
    access_token: str | None = Field(default=None, max_length=500)
    login_channel_id: str = Field(min_length=1, max_length=20)
    liff_id: str = Field(min_length=1, max_length=64)


class LineOaCheck(BaseModel):
    key: str
    label: str
    ok: bool
    detail: str | None = None
    required: bool = True


class LineOaVerifyOut(BaseModel):
    enabled: bool
    checks: list[LineOaCheck]
    settings: LineOaOut


class LineOaPublic(BaseModel):
    """LIFF 入口（未登入）讀取：是否啟用、LIFF ID、健身房名稱、加好友網址。"""

    enabled: bool
    liff_id: str | None = None
    gym_name: str
    bot_name: str | None = None
    add_friend_url: str | None = None


class LineAuthIn(BaseModel):
    id_token: str = Field(min_length=10, max_length=4000)


class LineAuthOut(BaseModel):
    """已綁定：status=ok＋登入 token；未綁定：status=unlinked＋只能用來加入或綁定的 link_token。"""

    status: Literal["ok", "unlinked"]
    token: Token | None = None
    link_token: str | None = None
    line_display_name: str | None = None


class LineJoinIn(BaseModel):
    link_token: str
    display_name: str = Field(min_length=1, max_length=50)
    phone: str = Field(min_length=8, max_length=30)
    # 個資告知同意（必須為 true）
    consent: bool
    # 同意接收優惠與活動訊息（選填，預設不同意；R31）
    marketing_consent: bool = False


class LineLinkIn(BaseModel):
    link_token: str
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


class LineOaNotifyUpdate(BaseModel):
    """會員通知設定：只更新有送出的欄位；member_monthly_cap 送 null 表示不限制。"""

    notify_booking_result: bool | None = None
    notify_booking_cancel: bool | None = None
    notify_payment_confirmed: bool | None = None
    notify_class_reminder: bool | None = None
    reminder_hour: int | None = Field(default=None, ge=6, le=22)
    member_monthly_cap: int | None = Field(default=None, ge=0, le=1000000)


class LineOaQuota(BaseModel):
    """LINE 官方帳號本月訊息額度（來自 LINE；讀不到時 error 有說明）。"""

    limited: bool | None = None
    limit: int | None = None
    used: int | None = None
    error: str | None = None


class LineMemberMessageOut(BaseModel):
    id: int
    event: str
    member_name: str
    status: str
    note: str | None
    created_at: datetime
    updated_at: datetime


class LinePreferences(BaseModel):
    """會員自己的 LINE 設定：只帶要改的欄位。"""

    # 服務通知（預約結果、上課提醒、收款）
    line_notify: bool | None = None
    # 優惠與活動訊息（行銷，R31）
    marketing_consent: bool | None = None
