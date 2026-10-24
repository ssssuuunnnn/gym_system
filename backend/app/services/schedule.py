"""
團體課表查詢：會員「預約課程」（routers/courses.py）與形象網站（routers/site.py）共用。
一列＝一堂可預約的團體課（課程上架、未封存，課堂未停課）。
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from app.models.coach import Coach
from app.models.course import Course, CourseSession, CourseStatus
from app.models.reservation import Reservation, ReservationStatus

# 計入名額的預約狀態（避免超收，待確認也算）
ACTIVE_RESERVATION_STATUSES = (ReservationStatus.pending, ReservationStatus.confirmed)


@dataclass
class GroupSession:
    session: CourseSession
    course: Course
    coach: Coach
    booked_count: int

    @property
    def key(self) -> tuple:
        return (self.course.id, self.session.session_date, self.session.start_minute // 60)


def group_sessions(db: Session, start: date, end: date) -> tuple[list[GroupSession], list[Reservation]]:
    """期間內的團體課堂（依日期、時間排序）與期間內計入名額的團體課預約。"""
    rows = (
        db.query(CourseSession, Course, Coach)
        .join(Course, CourseSession.course_id == Course.id)
        .join(Coach, Course.coach_id == Coach.id)
        .filter(
            Course.status == CourseStatus.on,
            Course.is_archived.is_(False),
            CourseSession.is_cancelled.is_(False),
            CourseSession.session_date >= start,
            CourseSession.session_date <= end,
        )
        .order_by(CourseSession.session_date, CourseSession.start_minute, Course.id)
        .all()
    )
    reservations = (
        db.query(Reservation)
        .filter(
            Reservation.course_id.isnot(None),
            Reservation.booking_date >= start,
            Reservation.booking_date <= end,
            Reservation.status.in_(ACTIVE_RESERVATION_STATUSES),
        )
        .all()
    )
    booked: dict[tuple, int] = {}
    for r in reservations:
        key = (r.course_id, r.booking_date, r.start_hour)
        booked[key] = booked.get(key, 0) + r.people_count
    sessions = []
    for session, course, coach in rows:
        key = (course.id, session.session_date, session.start_minute // 60)
        sessions.append(GroupSession(session=session, course=course, coach=coach, booked_count=booked.get(key, 0)))
    return sessions, reservations
