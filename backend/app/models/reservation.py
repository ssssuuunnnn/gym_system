import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.tenant import TenantMixin


class ReservationStatus(str, enum.Enum):
    pending = "待確認"
    confirmed = "已確認"
    rejected = "已拒絕"
    cancelled = "已取消"


class Attendance(str, enum.Enum):
    attended = "已出席"
    no_show = "未到"


class ReservationSource(str, enum.Enum):
    member_submitted = "member_submitted"
    admin_created = "admin_created"


class Reservation(TenantMixin, Base):
    """
    預約。容量檢查以所屬課程的每堂容量（course.max_capacity）為上限，由查詢邏輯即時計算，不另建計數表。
    source=admin_created 的預約寫入前同樣須檢查 time_slots.is_open，關閉時段不可建立。
    """

    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, comment="預約歸屬會員")
    coach_id: Mapped[int | None] = mapped_column(ForeignKey("coaches.id"), nullable=True)
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"), nullable=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    purchase_id: Mapped[int | None] = mapped_column(ForeignKey("purchases.id"), nullable=True)

    booking_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_hour: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    people_count: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)

    status: Mapped[ReservationStatus] = mapped_column(
        Enum(ReservationStatus), default=ReservationStatus.pending, nullable=False
    )
    source: Mapped[ReservationSource] = mapped_column(Enum(ReservationSource), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # 晚取消：已確認的預約在取消期限內（開課前 N 小時內）才取消；預設不退堂（見 docs/business-rules.md）
    late_cancel: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="0", default=False, comment="是否為期限內取消"
    )

    # 出席狀態：僅「已確認」的預約可簽到；NULL＝尚未簽到。已出席／未到皆不退堂。
    attendance: Mapped[Attendance | None] = mapped_column(Enum(Attendance), nullable=True, comment="出席狀態")
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="標記出席狀態的時間")
    checked_in_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, comment="標記者")

    member: Mapped["User"] = relationship("User", foreign_keys=[member_id])
    coach: Mapped["Coach | None"] = relationship("Coach", foreign_keys=[coach_id])
    course: Mapped["Course | None"] = relationship("Course", foreign_keys=[course_id])
    product: Mapped["Product"] = relationship("Product")
    purchase: Mapped["Purchase | None"] = relationship("Purchase", foreign_keys=[purchase_id])
    addons: Mapped[list["ReservationAddon"]] = relationship("ReservationAddon", back_populates="reservation")


class ReservationAddon(TenantMixin, Base):
    """加購臨時加人：送出預約申請後另開的加購步驟，僅教練身份會員可產生。"""

    __tablename__ = "reservation_addons"

    id: Mapped[int] = mapped_column(primary_key=True)
    reservation_id: Mapped[int] = mapped_column(ForeignKey("reservations.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, comment="固定為「臨時加人」商品")
    extra_people: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    purchase_id: Mapped[int | None] = mapped_column(ForeignKey("purchases.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    reservation: Mapped["Reservation"] = relationship("Reservation", back_populates="addons")
    product: Mapped["Product"] = relationship("Product")
    purchase: Mapped["Purchase | None"] = relationship("Purchase", foreign_keys=[purchase_id])
