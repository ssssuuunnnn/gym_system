import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class PaymentStatus(str, enum.Enum):
    unpaid = "待付款"
    paid = "已付款"
    cancelled = "已取消"


class PaymentMethod(str, enum.Enum):
    cash = "現金"
    transfer = "轉帳"
    card = "刷卡"
    other = "其他"


class Purchase(Base):
    """
    購買紀錄：購買歸屬對象不限教練身份，學員與場租教練皆可登錄購買。

    付款狀態：
    - 管理員「購買紀錄登錄」視為已收款，建立即為「已付款」並入帳堂數。
    - 會員「購買商品」建立為「待付款」，remaining_hours 為 0；管理員確認收款後才入帳 total_hours。
    - 只有「待付款」可取消（用品歸還保留的庫存）。

    remaining_hours 只能透過 app.services.hours 增減（同時寫 hour_ledger）。
    """

    __tablename__ = "purchases"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, comment="購買歸屬會員")
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(nullable=False)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    # 購買的總堂數＝建立當下的 商品堂數 × 數量；確認收款時依此入帳，不受之後商品堂數變動影響
    total_hours: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False, server_default="0", default=0, comment="購買總堂數"
    )
    remaining_hours: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), nullable=False, server_default="paid", default=PaymentStatus.unpaid, comment="付款狀態"
    )
    payment_method: Mapped[PaymentMethod | None] = mapped_column(Enum(PaymentMethod), nullable=True, comment="付款方式")
    payment_note: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="收款備註，例如轉帳末五碼")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="確認收款時間")
    paid_confirmed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, comment="確認收款的管理員")
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, comment="登錄的管理員（會員自助購買時為會員本人）")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    product: Mapped["Product"] = relationship("Product")
