import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CourseStatus(str, enum.Enum):
    on = "上架"
    off = "下架"
    draft = "草稿"


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, comment="課程編號 GC-YYYY-NNN")
    coach_id: Mapped[int] = mapped_column(ForeignKey("coaches.id"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    start_hour: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="60", default=60, comment="單堂時長（分鐘）"
    )
    min_capacity: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="1", default=1, comment="最低開班人數"
    )
    max_capacity: Mapped[int] = mapped_column(SmallInteger, nullable=False, comment="報名人數上限")
    session_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0", default=0, comment="課堂數"
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True, comment="課程介紹")
    cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="封面圖網址")
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True, comment="開課起日")
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True, comment="開課訖日")
    # SQLAlchemy Enum 預設以成員名稱（on/off/draft）入庫，API 層由 Pydantic 轉回中文 value
    status: Mapped[CourseStatus] = mapped_column(
        Enum(CourseStatus), nullable=False, server_default="on", default=CourseStatus.draft
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, server_default=func.now(), nullable=False
    )
    updated_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="最後編輯者帳號")

    coach: Mapped["Coach"] = relationship("Coach")
