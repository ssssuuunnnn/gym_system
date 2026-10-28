"""
會員名單（見 docs/adr/0006-member-segments.md、R32）：依上課紀錄篩出會員，
標出誰能收到 LINE 行銷訊息（已綁定 LINE 且同意行銷），再上傳成健身房官方帳號的受眾。
"""

from datetime import timedelta

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core import clock
from app.models.course import Course
from app.models.product import Product, ProductCategory
from app.models.purchase import PaymentStatus, Purchase
from app.models.reservation import Attendance, Reservation, ReservationStatus
from app.models.user import User, UserRole
from app.schemas.member_segment import SegmentFilters, SegmentMember, SegmentResult

ATTENDED = (Reservation.status == ReservationStatus.confirmed, Reservation.attendance == Attendance.attended)


def reach_of(user: User) -> str:
    if not user.line_user_id:
        return "未綁定 LINE"
    if not user.marketing_consent:
        return "未同意優惠訊息"
    return "可發送"


def find_members(db: Session, f: SegmentFilters) -> list[tuple[User, SegmentMember]]:
    """符合條件的會員（不含管理員與黑名單），依最後上課日由近到遠。"""
    period = (
        db.query(Reservation.member_id, func.count(Reservation.id))
        .outerjoin(Course, Course.id == Reservation.course_id)
        .filter(*ATTENDED, Reservation.booking_date >= f.start, Reservation.booking_date <= f.end)
    )
    if f.kind == "團體課":
        period = period.filter(Reservation.course_id.isnot(None))
    elif f.kind == "私人課":
        period = period.filter(Reservation.course_id.is_(None))
    if f.coach_id is not None:
        period = period.filter(or_(Reservation.coach_id == f.coach_id, Course.coach_id == f.coach_id))
    counts = dict(
        period.group_by(Reservation.member_id).having(func.count(Reservation.id) >= f.min_attended).all()
    )
    if not counts:
        return []
    ids = list(counts)

    # 最後一次上課（不限期間、不限類型）
    last = dict(
        db.query(Reservation.member_id, func.max(Reservation.booking_date))
        .filter(*ATTENDED, Reservation.member_id.in_(ids))
        .group_by(Reservation.member_id)
        .all()
    )
    # 剩餘堂數：已付款的課程方案加總
    remaining = dict(
        db.query(Purchase.user_id, func.coalesce(func.sum(Purchase.remaining_hours), 0))
        .join(Product, Product.id == Purchase.product_id)
        .filter(
            Purchase.user_id.in_(ids),
            Purchase.payment_status == PaymentStatus.paid,
            Product.category != ProductCategory.supply,
        )
        .group_by(Purchase.user_id)
        .all()
    )
    today = clock.now_local().date()
    users = db.query(User).filter(User.id.in_(ids), User.role == UserRole.member, User.is_blacklisted.is_(False))

    rows = []
    for user in users:
        hours = float(remaining.get(user.id, 0))
        last_day = last[user.id]
        if f.max_remaining_hours is not None and hours > f.max_remaining_hours:
            continue
        if f.inactive_days is not None and last_day > today - timedelta(days=f.inactive_days):
            continue
        rows.append(
            (
                user,
                SegmentMember(
                    id=user.id,
                    name=user.display_name or user.username,
                    username=user.username,
                    phone=user.phone,
                    attended_count=counts[user.id],
                    last_attended=last_day,
                    remaining_hours=hours,
                    reach=reach_of(user),
                ),
            )
        )
    rows.sort(key=lambda r: (r[1].last_attended, r[1].id), reverse=True)
    return rows


def summarize(rows: list[tuple[User, SegmentMember]]) -> SegmentResult:
    members = [m for _, m in rows]
    return SegmentResult(
        total=len(members),
        sendable=sum(m.reach == "可發送" for m in members),
        no_line=sum(m.reach == "未綁定 LINE" for m in members),
        no_consent=sum(m.reach == "未同意優惠訊息" for m in members),
        members=members,
    )
