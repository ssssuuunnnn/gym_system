import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.tenant import TenantMixin


class PayoutStatus(str, enum.Enum):
    settled = "已結算"
    paid = "已撥款"


class PayoutItemKind(str, enum.Enum):
    private = "私人課"
    group = "團體課"


class CoachPayout(TenantMixin, Base):
    """
    教練月結（R11–R14）：結算當下把該月的堂數、費率、金額與明細存成快照並鎖定，
    之後修改出席紀錄或教練費率都不影響已結算金額。已結算尚未撥款時可取消結算重算。
    """

    __tablename__ = "coach_payouts"
    __table_args__ = (UniqueConstraint("coach_id", "period", name="uq_coach_payouts_coach_period"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("coaches.id"), nullable=False, index=True)
    period: Mapped[date] = mapped_column(Date, nullable=False, comment="結算月份（該月 1 日）")
    session_count: Mapped[int] = mapped_column(nullable=False, comment="計費堂數")
    # 結算當下教練的私人課每堂鐘點費（參考用；團體課依各堂 fee）
    rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, comment="結算當下的私人課每堂鐘點費")
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, comment="應付金額＝明細 fee 加總")
    status: Mapped[PayoutStatus] = mapped_column(Enum(PayoutStatus), nullable=False, default=PayoutStatus.settled)
    settled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    settled_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paid_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    payment_note: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="撥款備註，例如匯款日期")

    coach: Mapped["Coach"] = relationship("Coach")
    items: Mapped[list["CoachPayoutItem"]] = relationship(
        "CoachPayoutItem",
        back_populates="payout",
        cascade="all, delete-orphan",
        order_by="(CoachPayoutItem.session_date, CoachPayoutItem.start_hour)",
    )


class CoachPayoutItem(TenantMixin, Base):
    """月結明細：一列＝一堂計費課（私人課＝一筆預約；團體課＝同課程同日同時段算一堂）。"""

    __tablename__ = "coach_payout_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    payout_id: Mapped[int] = mapped_column(
        ForeignKey("coach_payouts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[PayoutItemKind] = mapped_column(Enum(PayoutItemKind), nullable=False)
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False, comment="課程或商品名稱（快照）")
    session_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_hour: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    fee: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False, comment="這堂的教練費（私人課＝教練費率；團體課＝課程每堂教練費）"
    )
    attended_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, comment="已出席人數（預約筆數）")
    no_show_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, comment="未到人數（預約筆數）")
    members: Mapped[str] = mapped_column(String(500), nullable=False, comment="學員帳號（快照，逗號分隔）")

    payout: Mapped["CoachPayout"] = relationship("CoachPayout", back_populates="items")
