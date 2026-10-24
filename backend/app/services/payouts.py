"""
教練鐘點計算（R11–R13，見 docs/business-rules.md）：

- 只計「已確認」且出席狀態為「已出席」或「未到」的預約；晚取消、未簽到都不算。
- 教練歸屬：有團體課程的預約歸該課程的授課教練；其餘歸預約指定的教練（coach_id）。
- 私人課：一筆預約算一堂。團體課：同一課程、同日、同時段不論人數算一堂。
- 教練以會員身份為自己預約的場地（member_id 為教練本人）不算鐘點。
- 月份依預約日期（工作室當地日期）。
"""

from calendar import monthrange
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models.coach import Coach
from app.models.coach_payout import PayoutItemKind
from app.models.course import Course
from app.models.reservation import Attendance, Reservation, ReservationStatus


@dataclass
class BillableUnit:
    kind: PayoutItemKind
    course_id: int | None
    title: str
    session_date: date
    start_hour: int
    attended_count: int = 0
    no_show_count: int = 0
    members: list[str] = field(default_factory=list)

    @property
    def key(self) -> tuple:
        return (self.kind, self.course_id, self.session_date, self.start_hour, self.attended_count, self.no_show_count)


def month_range(period: date) -> tuple[date, date]:
    first = period.replace(day=1)
    last = first.replace(day=monthrange(first.year, first.month)[1])
    return first, last


def billable_units(db: Session, coach: Coach, period: date) -> list[BillableUnit]:
    first, last = month_range(period)
    rows = (
        db.query(Reservation)
        .options(joinedload(Reservation.member), joinedload(Reservation.product), joinedload(Reservation.course))
        .filter(
            Reservation.status == ReservationStatus.confirmed,
            Reservation.attendance.isnot(None),
            Reservation.booking_date >= first,
            Reservation.booking_date <= last,
            Reservation.member_id != coach.user_id,
        )
        .order_by(Reservation.booking_date, Reservation.start_hour, Reservation.id)
        .all()
    )

    units: dict[tuple, BillableUnit] = {}
    for r in rows:
        course: Course | None = r.course
        if course is not None:
            if course.coach_id != coach.id:
                continue
            key = ("group", course.id, r.booking_date, r.start_hour)
            unit = units.get(key)
            if unit is None:
                unit = units[key] = BillableUnit(
                    PayoutItemKind.group, course.id, course.name, r.booking_date, r.start_hour
                )
        else:
            if r.coach_id != coach.id:
                continue
            key = ("private", r.id)
            unit = units[key] = BillableUnit(
                PayoutItemKind.private, None, r.product.name, r.booking_date, r.start_hour
            )
        if r.attendance == Attendance.attended:
            unit.attended_count += 1
        else:
            unit.no_show_count += 1
        unit.members.append(r.member.username)

    return sorted(units.values(), key=lambda u: (u.session_date, u.start_hour, u.kind.value, u.course_id or 0))


def amount_for(session_count: int, rate) -> Decimal:
    return (Decimal(session_count) * Decimal(str(rate))).quantize(Decimal("0.01"))
