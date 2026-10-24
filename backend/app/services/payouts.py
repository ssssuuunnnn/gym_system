"""
教練鐘點計算（R11–R14，見 docs/business-rules.md）：

- 只計「已確認」且出席狀態為「已出席」或「未到」的預約；晚取消、未簽到都不算。
- 團體課：有團體課程的預約歸該課程的授課教練；同一課程、同日、同時段不論人數算一堂，
  費用＝該課程的「每堂教練費」（coach_fee）。
- 私人課：沒有課程的預約歸預約指定的教練，一筆算一堂，費用＝教練的「私人課每堂鐘點費」
  （session_rate）。只有「私人教練」類型才計；場租教練的學員工作室不付鐘點。
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
    fee: Decimal = Decimal("0")
    attended_count: int = 0
    no_show_count: int = 0
    members: list[str] = field(default_factory=list)

    @property
    def key(self) -> tuple:
        return (
            self.kind, self.course_id, self.session_date, self.start_hour,
            self.attended_count, self.no_show_count, money(self.fee),
        )


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
                    PayoutItemKind.group, course.id, course.name, r.booking_date, r.start_hour,
                    fee=money(course.coach_fee),
                )
        else:
            if r.coach_id != coach.id or not coach.is_private_coach:
                continue
            key = ("private", r.id)
            unit = units[key] = BillableUnit(
                PayoutItemKind.private, None, r.product.name, r.booking_date, r.start_hour,
                fee=money(coach.session_rate),
            )
        if r.attendance == Attendance.attended:
            unit.attended_count += 1
        else:
            unit.no_show_count += 1
        unit.members.append(r.member.username)

    return sorted(units.values(), key=lambda u: (u.session_date, u.start_hour, u.kind.value, u.course_id or 0))


def money(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def total_amount(units) -> Decimal:
    """各堂費用加總（BillableUnit 或 CoachPayoutItem 皆可）。"""
    return money(sum((Decimal(str(u.fee)) for u in units), Decimal("0")))


def is_payable_coach(coach: Coach) -> bool:
    """公司要付鐘點的教練：私人教練或團體課程教練（場租教練不算）。"""
    return coach.is_private_coach or coach.is_group_coach
