"""
LINE 通知店家（見 docs/adr/0004-line-notifications.md）。

租戶資料表（RLS）：
- line_recipients：綁定了平台 LINE 通知帳號的老闆／員工，以及各自要收哪些通知
- line_bind_codes：後台產生的 6 位數綁定碼（只存雜湊）
- line_notifications：待發送／已發送的通知（outbox）。發送成功後清掉訊息內容，只留則數與結果

平台資料表（無 RLS）：
- line_bind_attempts：LINE 使用者傳送綁定碼的嘗試紀錄，用來限制猜碼
"""

import enum
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.tenant import TenantMixin


class LineEvent(str, enum.Enum):
    inquiry = "新的體驗課詢問"
    payment = "會員下單待收款"
    booking = "預約待審核"
    test = "測試通知"


class LineNotificationStatus(str, enum.Enum):
    pending = "待發送"
    retrying = "重試中"
    sent = "成功"
    failed = "失敗"
    skipped_cap = "超過上限"
    skipped_disabled = "未設定 LINE"


class LineRecipient(TenantMixin, Base):
    __tablename__ = "line_recipients"
    __table_args__ = (UniqueConstraint("tenant_id", "line_user_id", name="uq_line_recipients_tenant_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    line_user_id: Mapped[str] = mapped_column(String(64), nullable=False, comment="LINE userId（平台帳號範圍內唯一）")
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    notify_inquiry: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notify_payment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notify_booking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    bound_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="產生綁定碼的管理員")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class LineBindCode(TenantMixin, Base):
    __tablename__ = "line_bind_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_by_name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    used_by_line_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)


class LineNotification(TenantMixin, Base):
    __tablename__ = "line_notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    event: Mapped[LineEvent] = mapped_column(Enum(LineEvent), nullable=False)
    # 發送對象（LINE userId）與訊息內容；成功或放棄後清空，不長期保存客人資料
    recipient_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    message: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    recipient_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="預計發送人數")
    sent_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0", comment="計入用量的則數")
    status: Mapped[LineNotificationStatus] = mapped_column(
        Enum(LineNotificationStatus), nullable=False, default=LineNotificationStatus.pending, index=True
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    note: Mapped[str | None] = mapped_column(String(300), nullable=True, comment="結果說明（不含客人資料）")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class LineBindAttempt(Base):
    """平台表：每個 LINE 使用者傳送綁定碼的嘗試（限制猜碼次數）。"""

    __tablename__ = "line_bind_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    line_user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    tenant_id: Mapped[int | None] = mapped_column(ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
