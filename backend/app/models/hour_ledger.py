import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.tenant import TenantMixin


class HourLedgerReason(str, enum.Enum):
    opening = "期初餘額"  # 導入本表前既有購買紀錄的餘額（migration 回填）
    purchase = "購買"
    reservation_deduct = "預約扣抵"
    reservation_refund = "預約退回"
    manual_adjust = "手動調整"


class HourLedger(TenantMixin, Base):
    """
    堂數異動紀錄：每一次 purchases.remaining_hours 的增減都寫一筆。
    purchases.remaining_hours 僅為快取，任一購買紀錄的
    SUM(delta) 應永遠等於其 remaining_hours（由 app.services.hours 保證）。
    """

    __tablename__ = "hour_ledger"

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("purchases.id"), nullable=False, index=True)
    reservation_id: Mapped[int | None] = mapped_column(
        ForeignKey("reservations.id"), nullable=True, index=True, comment="預約扣抵／退回時關聯的預約"
    )
    delta: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, comment="異動堂數，正數＝增加、負數＝扣抵")
    balance_after: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, comment="異動後剩餘堂數")
    reason: Mapped[HourLedgerReason] = mapped_column(Enum(HourLedgerReason), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, comment="操作者")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    purchase: Mapped["Purchase"] = relationship("Purchase")
