from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, Boolean, DateTime, Numeric, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class CoachSettlementRates(Base):
    """教練費用結算鐘點費設定：全站僅一筆（singleton），依課程類型設定共用費率。"""

    __tablename__ = "coach_settlement_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_course_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    # 一對一、場租目前尚無對應課程資料可結算，欄位先保留供日後串接
    private_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    venue_rental_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class CoachSettlementPeriod(Base):
    """單一結算月份的鎖定狀態；鎖定時將計算結果存入 snapshot_json，避免日後鐘點費異動回頭影響歷史月份。"""

    __tablename__ = "coach_settlement_periods"
    __table_args__ = (UniqueConstraint("year", "month", name="uq_coach_settlement_period_year_month"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # 鎖定當下計算出的結算內容（CoachSettlementSummary 的 JSON 內容）
    snapshot_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
