"""
預約的時間規則：取消期限（R8）與簽到時間窗（R9、R10）。規則說明見 docs/business-rules.md。

時間一律以工作室當地時間（app.core.clock.now_local）比較；預約的開課時間為
booking_date + start_hour（不帶時區的當地時間）。
"""

from datetime import datetime, time, timedelta

from sqlalchemy.orm import Session

from app.core import clock
from app.models.course import Course
from app.models.reservation import Reservation, ReservationStatus
from app.models.system_settings import SystemSettings

# 學員自行簽到：開課前 30 分鐘起，到下課為止
SELF_CHECK_IN_OPENS_BEFORE = timedelta(minutes=30)
# 教練／管理員可提早標記的時間（之後不限，方便補登）
STAFF_CHECK_IN_OPENS_BEFORE = timedelta(minutes=30)
DEFAULT_DURATION_MINUTES = 60
DEFAULT_CANCEL_DEADLINE_HOURS = 12


def class_start(reservation: Reservation) -> datetime:
    return datetime.combine(reservation.booking_date, time(hour=reservation.start_hour))


def class_end(db: Session, reservation: Reservation) -> datetime:
    minutes = DEFAULT_DURATION_MINUTES
    if reservation.course_id is not None:
        course = db.get(Course, reservation.course_id)
        if course is not None and course.duration_minutes:
            minutes = course.duration_minutes
    return class_start(reservation) + timedelta(minutes=minutes)


def cancel_deadline_hours(db: Session) -> int:
    row = db.query(SystemSettings).first()
    return row.cancel_deadline_hours if row is not None else DEFAULT_CANCEL_DEADLINE_HOURS


def is_late_cancel(db: Session, reservation: Reservation, now: datetime | None = None) -> bool:
    """
    是否為期限內取消（晚取消）。只有「已確認」的預約才適用；待確認的預約工作室尚未接受，取消一律退堂。
    期限為 0 時不限制。
    """
    if reservation.status != ReservationStatus.confirmed:
        return False
    hours = cancel_deadline_hours(db)
    if hours <= 0:
        return False
    now = now or clock.now_local()
    return now >= class_start(reservation) - timedelta(hours=hours)


def has_started(reservation: Reservation, now: datetime | None = None) -> bool:
    return (now or clock.now_local()) >= class_start(reservation)


def self_check_in_open(db: Session, reservation: Reservation, now: datetime | None = None) -> bool:
    now = now or clock.now_local()
    return class_start(reservation) - SELF_CHECK_IN_OPENS_BEFORE <= now <= class_end(db, reservation)


def staff_check_in_open(reservation: Reservation, now: datetime | None = None) -> bool:
    now = now or clock.now_local()
    return now >= class_start(reservation) - STAFF_CHECK_IN_OPENS_BEFORE
