from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Purchase(Base):
    """
    購買紀錄：購買歸屬對象不限教練身份，學員與場租教練皆可登錄購買。
    remaining_hours 隨預約成立／取消即時增減，避免每次重新加總歷史紀錄。
    """

    __tablename__ = "purchases"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, comment="購買歸屬會員")
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(nullable=False)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    remaining_hours: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, comment="登錄的管理員")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    product: Mapped["Product"] = relationship("Product")
