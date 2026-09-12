from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.course import Course
from app.models.reservation import Reservation, ReservationCheckinMethod, ReservationStatus
from app.models.user import User
from app.schemas.public_checkin import (
    PublicCheckinEntryOut,
    PublicCheckinRequest,
    PublicCheckinResponse,
    PublicCheckinRosterOut,
    PublicCheckinSessionOut,
)

# 全公開路由（第二螢幕看板專用）：本檔內任何 endpoint 皆不掛
# get_current_user / require_admin / require_coach，刻意設計為免登入可用。
# 範圍刻意限縮：僅回傳單一堂課的姓名與報到狀態（不含帳號以外個資），
# 且只允許「未報到 → 已報到」單向切換，不提供取消報到、不暴露其他任何資料。
router = APIRouter(prefix="/public/checkin", tags=["public-checkin"])


@router.get("/roster", response_model=PublicCheckinRosterOut)
def public_get_roster(course_id: int, booking_date: date, start_hour: int, db: Session = Depends(get_db)):
    """對應第二螢幕「名單看板」：僅回傳可辨識身份用的最少欄位。"""
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到課程")

    rows = (
        db.query(Reservation, User.username)
        .join(User, Reservation.member_id == User.id)
        .filter(
            Reservation.course_id == course_id,
            Reservation.booking_date == booking_date,
            Reservation.start_hour == start_hour,
            Reservation.status == ReservationStatus.confirmed,
        )
        .order_by(User.username)
        .all()
    )
    entries = [
        PublicCheckinEntryOut(
            reservation_id=r.id,
            display_name=username,
            checked_in=r.checked_in_at is not None,
            checked_in_at=r.checked_in_at,
        )
        for r, username in rows
    ]
    checked_in_count = sum(1 for e in entries if e.checked_in)

    return PublicCheckinRosterOut(
        session=PublicCheckinSessionOut(
            course_id=course.id,
            course_name=course.name,
            booking_date=booking_date,
            start_hour=start_hour,
        ),
        entries=entries,
        checked_in_count=checked_in_count,
        total_count=len(entries),
    )


@router.post("/check-in", response_model=PublicCheckinResponse)
def public_check_in(payload: PublicCheckinRequest, db: Session = Depends(get_db)):
    """
    對應「名單看板」點名磚自助報到：僅允許未報到 → 已報到（無 undo）。
    course_id/booking_date/start_hour 必須與該 reservation 實際歸屬一致，
    防止用他堂課的網址猜測／竄改別堂課的 reservation_id。
    """
    reservation = db.get(Reservation, payload.reservation_id)
    if (
        reservation is None
        or reservation.course_id != payload.course_id
        or reservation.booking_date != payload.booking_date
        or reservation.start_hour != payload.start_hour
        or reservation.status != ReservationStatus.confirmed
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到此堂課的報名紀錄")

    if reservation.checked_in_at is not None:
        return PublicCheckinResponse(
            reservation_id=reservation.id,
            checked_in=True,
            checked_in_at=reservation.checked_in_at,
            already_checked_in=True,
        )

    reservation.checked_in_at = datetime.utcnow()
    reservation.checked_in_method = ReservationCheckinMethod.kiosk_self
    db.commit()
    db.refresh(reservation)
    return PublicCheckinResponse(
        reservation_id=reservation.id,
        checked_in=True,
        checked_in_at=reservation.checked_in_at,
        already_checked_in=False,
    )
