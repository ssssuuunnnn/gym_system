from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.tenant import TenantMixin


class TimeSlot(TenantMixin, Base):
    """
    時段開放設定：唯一資料來源。預約審核列表／詳情、送出預約申請（含管理員建立預約）皆讀取同一張表。
    綁定特定日期（日期＋整點小時），各日期獨立，不套用到其他週。查無紀錄視為預設開放。
    """

    __tablename__ = "time_slots"
    # 公休各分店獨立（ADR 0007、R34）
    __table_args__ = (
        UniqueConstraint("tenant_id", "branch_id", "slot_date", "start_hour", name="uq_time_slots_branch_date_hour"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False, index=True)
    slot_date: Mapped[date] = mapped_column(Date, nullable=False, comment="綁定日期")
    start_hour: Mapped[int] = mapped_column(SmallInteger, nullable=False, comment="10-21，每格60分鐘")
    is_open: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    branch: Mapped["Branch"] = relationship("Branch")
