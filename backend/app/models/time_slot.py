from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class TimeSlot(Base):
    """
    時段開放設定：唯一資料來源。預約審核列表／詳情、送出預約申請（含管理員建立預約）皆讀取同一張表。
    每週固定樣板（星期＋整點小時），不綁定特定日期。
    """

    __tablename__ = "time_slots"
    __table_args__ = (UniqueConstraint("day_of_week", "start_hour", name="uq_time_slots_day_hour"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False, comment="1-6，週日不適用")
    start_hour: Mapped[int] = mapped_column(SmallInteger, nullable=False, comment="10-21，每格60分鐘")
    is_open: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
