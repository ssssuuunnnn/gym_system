import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CourseStatus(str, enum.Enum):
    on = "上架"
    off = "下架"
    draft = "草稿"


class ScheduleFrequency(str, enum.Enum):
    weekly = "每週"
    biweekly = "隔週"


class ScheduleEndMode(str, enum.Enum):
    count = "連續"
    date = "結束於"


class SessionSource(str, enum.Enum):
    rule = "規則"
    extra = "單次加開"


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, comment="課程編號 GC-YYYY-NNN")
    coach_id: Mapped[int] = mapped_column(ForeignKey("coaches.id"), nullable=False)
    # 「主要時段」——存第一堂的星期與整點，供列表摘要與相容用途；草稿可無任何課堂故允許 NULL
    day_of_week: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    start_hour: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
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
    rules: Mapped[list["CourseScheduleRule"]] = relationship(
        "CourseScheduleRule",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="CourseScheduleRule.position",
    )
    sessions: Mapped[list["CourseSession"]] = relationship(
        "CourseSession",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="CourseSession.position",
    )


class CourseScheduleRule(Base):
    """一列排課規則：產生一組週期性課堂。編輯時完整還原，重新展開為課堂。"""

    __tablename__ = "course_schedule_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False, comment="列順序，對應「規則 1 / 2…」")
    start_date: Mapped[date] = mapped_column(Date, nullable=False, comment="規則起始日")
    start_minute: Mapped[int] = mapped_column(SmallInteger, nullable=False, comment="開始時間，自午夜起算分鐘")
    frequency: Mapped[ScheduleFrequency] = mapped_column(Enum(ScheduleFrequency), nullable=False)
    end_mode: Mapped[ScheduleEndMode] = mapped_column(Enum(ScheduleEndMode), nullable=False)
    week_count: Mapped[int | None] = mapped_column(SmallInteger, nullable=True, comment="連續週數（end_mode=count）")
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True, comment="結束日（end_mode=date）")

    course: Mapped["Course"] = relationship("Course", back_populates="rules")


class CourseSession(Base):
    """單一課堂：由排課規則展開或單次加開；可逐堂調整日期／時間。"""

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
    rule_position: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True, comment="來源規則序號；單次加開為 NULL"
    )
    adjusted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="0", default=False)
    origin_date: Mapped[date | None] = mapped_column(Date, nullable=True, comment="調整前日期（adjusted 時填）")
    origin_minute: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True, comment="調整前開始時間（adjusted 時填）"
    )

    course: Mapped["Course"] = relationship("Course", back_populates="sessions")
