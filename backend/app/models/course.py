import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CourseStatus(str, enum.Enum):
    on = "上架"
    off = "下架"
    draft = "草稿"


class ScheduleEndMode(str, enum.Enum):
    count = "週數"
    date = "結束日"


class SessionSource(str, enum.Enum):
    scheduled = "排程"
    extra = "加開"


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, comment="課程編號 GC-YYYY-NNN")
    coach_id: Mapped[int] = mapped_column(ForeignKey("coaches.id"), nullable=False)
    # 「主要時段」——存最小的上課星期，供列表摘要與相容用途；草稿可無排程故允許 NULL
    day_of_week: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    start_hour: Mapped[int | None] = mapped_column(SmallInteger, nullable=True, comment="上課時間（整點）")
    duration_minutes: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="60", default=60, comment="單堂時長（分鐘）"
    )
    min_capacity: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="1", default=1, comment="最低開班人數"
    )
    max_capacity: Mapped[int] = mapped_column(SmallInteger, nullable=False, comment="每堂報名人數上限")
    # 每堂教練費：團體課程教練鐘點結算用，一堂不論人數給這個金額（R12）；僅管理員可見
    coach_fee: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False, server_default="0", default=0, comment="每堂教練費"
    )
    session_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0", default=0, comment="課堂數（未停課）"
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True, comment="課程介紹")
    cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="封面圖網址")
    # 排程規格
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True, comment="開課起日")
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True, comment="開課訖日")
    end_mode: Mapped[ScheduleEndMode | None] = mapped_column(
        Enum(ScheduleEndMode), nullable=True, comment="開課期間結束方式：週數 / 結束日"
    )
    week_count: Mapped[int | None] = mapped_column(SmallInteger, nullable=True, comment="開課週數（end_mode=count）")
    # SQLAlchemy Enum 預設以成員名稱（on/off/draft）入庫，API 層由 Pydantic 轉回中文 value
    status: Mapped[CourseStatus] = mapped_column(
        Enum(CourseStatus), nullable=False, server_default="on", default=CourseStatus.draft
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="0", default=False, comment="是否已封存"
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="封存時間")
    archived_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="封存者帳號")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, server_default=func.now(), nullable=False
    )
    updated_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="最後編輯者帳號")

    coach: Mapped["Coach"] = relationship("Coach")
    weekday_rows: Mapped[list["CourseWeekday"]] = relationship(
        "CourseWeekday",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="CourseWeekday.weekday",
    )
    sessions: Mapped[list["CourseSession"]] = relationship(
        "CourseSession",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="CourseSession.position",
    )

    @property
    def weekdays(self) -> list[int]:
        """上課星期的整數清單（供 API 序列化）。"""
        return [w.weekday for w in self.weekday_rows]


class CourseWeekday(Base):
    """一門課的上課星期（ISO：1=週一…7=週日）；多選。"""

    __tablename__ = "course_weekdays"
    __table_args__ = (UniqueConstraint("course_id", "weekday", name="uq_course_weekday"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    weekday: Mapped[int] = mapped_column(SmallInteger, nullable=False, comment="ISO 星期 1–7")

    course: Mapped["Course"] = relationship("Course", back_populates="weekday_rows")


class CourseSession(Base):
    """單一課堂：由排程展開或單次加開；可逐堂停課（保留紀錄）。"""

    __tablename__ = "course_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False, comment="顯示順序")
    session_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_minute: Mapped[int] = mapped_column(SmallInteger, nullable=False, comment="開始時間，自午夜起算分鐘")
    duration_minutes: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    source: Mapped[SessionSource] = mapped_column(Enum(SessionSource), nullable=False)
    is_cancelled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="0", default=False, comment="停課（保留紀錄）"
    )

    course: Mapped["Course"] = relationship("Course", back_populates="sessions")
