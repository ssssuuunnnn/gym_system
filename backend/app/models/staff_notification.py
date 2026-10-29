import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.tenant import TenantMixin


class StaffNotificationKind(str, enum.Enum):
    """後台通知的種類（ADR 0009）。資料庫存成員名稱。"""

    booking_submitted = "新預約"
    booking_cancelled = "會員取消預約"
    order_unpaid = "新訂單"
    inquiry_new = "新詢問"


class StaffNotification(TenantMixin, Base):
    """
    後台鈴鐺通知（ADR 0009）：每位收件人各一筆，已讀時間各自記。
    收件人是事件發生當下有對應功能權限、未停用的後台帳號。內容只放姓名與摘要，不放電話。
    """

    __tablename__ = "staff_notifications"
    __table_args__ = (Index("ix_staff_notifications_user_id_id", "user_id", "id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[StaffNotificationKind] = mapped_column(Enum(StaffNotificationKind), nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    body: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    # 點通知後前往的後台頁面（站內路徑，例如 /admin/reservations?highlight=12）
    link: Mapped[str] = mapped_column(String(300), nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
