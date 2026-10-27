from datetime import datetime

import enum

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, Integer, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.line import LineNotificationStatus
from app.models.tenant import TenantMixin


class LineOaChannel(TenantMixin, Base):
    """
    健身房自己的 LINE 官方帳號（見 docs/adr/0005-gym-line-oa.md），每家一筆。
    Messaging API channel（Webhook、底部選單、回覆）與同一個 Provider 底下的 LINE 登入 channel＋LIFF（會員在 LINE 裡登入）。
    channel secret 與 access token 以 core.crypto 加密，不回傳給前端。
    """

    __tablename__ = "line_oa_channels"
    __table_args__ = (UniqueConstraint("tenant_id", name="uq_line_oa_channels_tenant"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    channel_secret_enc: Mapped[str] = mapped_column(Text, nullable=False)
    access_token_enc: Mapped[str] = mapped_column(Text, nullable=False)
    login_channel_id: Mapped[str] = mapped_column(String(20), nullable=False)
    liff_id: Mapped[str] = mapped_column(String(64), nullable=False)
    # 「檢查連線」成功才啟用；改了任何金鑰／ID 都要重新檢查
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # 從 LINE 讀回的官方帳號資料
    bot_basic_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    bot_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bot_picture_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rich_menu_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    updated_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 會員通知（第二階段）：從這家的官方帳號推播給會員，費用算在健身房的 LINE 方案
    notify_booking_result: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notify_booking_cancel: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notify_payment_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notify_class_reminder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    # 上課提醒：前一天這個整點（健身房當地時間）發送，只在此後 2 小時內產生
    reminder_hour: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=20, server_default="20")
    # 每月最多推播幾則（留空＝不限制，以 LINE 方案額度為準）
    member_monthly_cap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class LineMemberEvent(str, enum.Enum):
    booking_confirmed = "預約成功"
    booking_rejected = "預約未成立"
    booking_cancelled = "預約已取消"
    payment_confirmed = "已收到款項"
    class_reminder = "上課提醒"


# 每種事件對應 line_oa_channels 的開關
MEMBER_EVENT_FLAG = {
    LineMemberEvent.booking_confirmed: "notify_booking_result",
    LineMemberEvent.booking_rejected: "notify_booking_result",
    LineMemberEvent.booking_cancelled: "notify_booking_cancel",
    LineMemberEvent.payment_confirmed: "notify_payment_confirmed",
    LineMemberEvent.class_reminder: "notify_class_reminder",
}


class LineMemberMessage(TenantMixin, Base):
    """
    從健身房自己的官方帳號推播給會員的訊息（outbox，見 ADR 0005 第二階段）。
    發送狀態沿用 LineNotificationStatus；送出（或放棄）後清掉訊息內容，只留事件、對象與結果。
    dedupe_key 避免同一件事發兩次（例如同一位會員同一天的上課提醒）。
    """

    __tablename__ = "line_member_messages"
    __table_args__ = (UniqueConstraint("tenant_id", "dedupe_key", name="uq_line_member_messages_dedupe"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    event: Mapped[LineMemberEvent] = mapped_column(Enum(LineMemberEvent), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    message: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped["LineNotificationStatus"] = mapped_column(
        Enum(LineNotificationStatus, name="linenotificationstatus", create_type=False), nullable=False,
        default=LineNotificationStatus.pending,
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    dedupe_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
