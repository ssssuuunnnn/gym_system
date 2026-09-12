from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user, require_admin, require_coach
from app.models.coach import Coach
from app.models.course import Course
from app.models.product import Product
from app.models.purchase import Purchase
from app.models.reservation import (
    Reservation,
    ReservationAddon,
    ReservationCheckinMethod,
    ReservationSource,
    ReservationStatus,
)
from app.models.time_slot import TimeSlot
from app.models.user import User, UserRole
from app.schemas.reservation import (
    CheckinRosterEntryOut,
    CheckinRosterOut,
    CheckinSessionSummaryOut,
    ReservationAddonCreate,
    ReservationAddonOut,
    ReservationCreate,
    ReservationOut,
    ReservationReview,
    ReservationUpdate,
)

router = APIRouter(prefix="/reservations", tags=["reservations"])

def _check_slot_open(db: Session, slot_date, start_hour: int) -> None:
    slot = (
        db.query(TimeSlot)
        .filter(TimeSlot.slot_date == slot_date, TimeSlot.start_hour == start_hour)
        .first()
    )
    # 尚未建立紀錄視為預設開放；已建立且 is_open=False 則不可預約（管理員建立預約亦受此限制）。
    if slot is not None and not slot.is_open:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="該時段已被管理員關閉，無法預約")


def _check_capacity(
    db: Session,
    product: Product,
    course_id: int | None,
    booking_date,
    start_hour: int,
    people_count: int,
) -> None:
    """
    課程商品以「該課程 × 日期 × 時段」的每堂容量（course.max_capacity）為上限；
    未關聯任何課程（course_id 與 product.course_id 皆為空）則不限量。
    """
    course_id = course_id or product.course_id
    if course_id is None:
        return
    course = db.get(Course, course_id)
    if course is None:
        return

    existing = (
        db.query(func.coalesce(func.sum(Reservation.people_count), 0))
        .filter(
            Reservation.course_id == course_id,
            Reservation.booking_date == booking_date,
            Reservation.start_hour == start_hour,
            Reservation.status == ReservationStatus.confirmed,
        )
        .scalar()
    )
    if int(existing) + people_count > course.max_capacity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="該時段容量已滿")


@router.get("", response_model=list[ReservationOut])
def list_reservations(
    member_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    對應「預約審核列表」（管理員，看全部，可用 member_id 篩選）與「我的預約列表」
    （會員，僅能查詢自己的預約，忽略／覆寫傳入的 member_id）。
    """
    query = db.query(Reservation)
    if current_user.role != UserRole.admin:
        query = query.filter(Reservation.member_id == current_user.id)
    elif member_id is not None:
        query = query.filter(Reservation.member_id == member_id)
    return query.order_by(Reservation.booking_date, Reservation.start_hour).all()


@router.get("/roster", response_model=CheckinRosterOut, dependencies=[Depends(require_admin)])
def get_checkin_roster(
    course_id: int,
    booking_date: date,
    start_hour: int,
    db: Session = Depends(get_db),
):
    """
    對應「課程報到」名單與報到狀態：以 course_id/booking_date/start_hour 三值定位單一堂課
    （reservations 無 course_sessions 外鍵，此三值即為容量檢查邏輯既有的定位方式）。
    """
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
        CheckinRosterEntryOut(
            id=r.id,
            member_id=r.member_id,
            username=username,
            people_count=r.people_count,
            status=r.status,
            checked_in_at=r.checked_in_at,
            checked_in_method=r.checked_in_method,
        )
        for r, username in rows
    ]
    checked_in_count = sum(1 for e in entries if e.checked_in_at is not None)

    return CheckinRosterOut(
        session=CheckinSessionSummaryOut(
            course_id=course.id,
            course_name=course.name,
            coach_name=course.coach.alias or course.coach.name,
            booking_date=booking_date,
            start_hour=start_hour,
            duration_minutes=course.duration_minutes,
            max_capacity=course.max_capacity,
        ),
        entries=entries,
        checked_in_count=checked_in_count,
        total_count=len(entries),
    )


@router.post("", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation(
    payload: ReservationCreate,
    as_admin: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    as_admin=true 時對應「管理員建立預約」（source=admin_created，狀態直接為已確認，
    仍須通過 time_slots 開放檢查）；否則對應「送出預約申請」
    （source=member_submitted，狀態為待確認）。
    """
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到商品")

    _check_slot_open(db, payload.booking_date, payload.start_hour)

    if as_admin:
        require_admin(current_user)
        source = ReservationSource.admin_created
        initial_status = ReservationStatus.confirmed
        _check_capacity(
            db, product, payload.course_id, payload.booking_date, payload.start_hour, payload.people_count
        )
    else:
        source = ReservationSource.member_submitted
        initial_status = ReservationStatus.pending

    payload_data = payload.model_dump()
    if not as_admin:
        # 非管理員送出申請一律歸屬自己，忽略／覆寫傳入的 member_id，避免冒名建立他人預約。
        payload_data["member_id"] = current_user.id

    reservation = Reservation(
        **payload_data,
        source=source,
        status=initial_status,
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    return reservation


@router.put("/{reservation_id}", response_model=ReservationOut)
def update_reservation(
    reservation_id: int,
    payload: ReservationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """對應「我的預約」編輯：會員／教練僅能編輯自己、且僅待確認狀態的預約。"""
    reservation = db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到預約")

    if current_user.role != UserRole.admin and reservation.member_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="僅能編輯自己的預約")

    if reservation.status != ReservationStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="僅待確認狀態可編輯")

    new_booking_date = payload.booking_date if payload.booking_date is not None else reservation.booking_date
    new_start_hour = payload.start_hour if payload.start_hour is not None else reservation.start_hour
    _check_slot_open(db, new_booking_date, new_start_hour)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(reservation, field, value)

    db.commit()
    db.refresh(reservation)
    return reservation


@router.post("/{reservation_id}/review", response_model=ReservationOut, dependencies=[Depends(require_admin)])
def review_reservation(reservation_id: int, payload: ReservationReview, db: Session = Depends(get_db)):
    """對應「預約審核列表／詳情」：核准／拒絕。核准前需再次確認容量。"""
    reservation = db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到預約")

    if payload.status == ReservationStatus.confirmed:
        product = db.get(Product, reservation.product_id)
        _check_capacity(
            db,
            product,
            reservation.course_id,
            reservation.booking_date,
            reservation.start_hour,
            reservation.people_count,
        )

    reservation.status = payload.status
    reservation.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(reservation)
    return reservation


@router.post("/{reservation_id}/cancel", response_model=ReservationOut)
def cancel_reservation(
    reservation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    對應「預約審核列表」取消按鈕（管理員）與「我的預約」取消（會員／教練自助取消自己的
    待確認／已確認預約）。
    """
    reservation = db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到預約")

    if current_user.role != UserRole.admin and reservation.member_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="僅能取消自己的預約")

    if reservation.status not in (ReservationStatus.pending, ReservationStatus.confirmed):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此預約狀態無法取消")

    reservation.status = ReservationStatus.cancelled
    reservation.cancelled_at = datetime.utcnow()

    if reservation.purchase_id:
        purchase = db.get(Purchase, reservation.purchase_id)
        if purchase:
            product = db.get(Product, reservation.product_id)
            purchase.remaining_hours += product.session_hours

    db.commit()
    db.refresh(reservation)
    return reservation


@router.post("/{reservation_id}/check-in", response_model=ReservationOut, dependencies=[Depends(require_admin)])
def check_in_reservation(
    reservation_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """對應「課程報到」手動報到。僅已確認預約可報到；重複呼叫為 idempotent（不覆寫報到時間）。"""
    reservation = db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到預約")
    if reservation.status != ReservationStatus.confirmed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="僅已確認的預約可報到")

    if reservation.checked_in_at is None:
        reservation.checked_in_at = datetime.utcnow()
        reservation.checked_in_method = ReservationCheckinMethod.admin_manual
        reservation.checked_in_by = current_user.id
        db.commit()
        db.refresh(reservation)
    return reservation


@router.post(
    "/{reservation_id}/check-in/undo", response_model=ReservationOut, dependencies=[Depends(require_admin)]
)
def undo_check_in(reservation_id: int, db: Session = Depends(get_db)):
    """對應「課程報到」取消報到；未報到時為 idempotent。"""
    reservation = db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到預約")

    if reservation.checked_in_at is not None:
        reservation.checked_in_at = None
        reservation.checked_in_method = None
        reservation.checked_in_by = None
        db.commit()
        db.refresh(reservation)
    return reservation


@router.post("/addons", response_model=ReservationAddonOut, status_code=status.HTTP_201_CREATED)
def create_addon(
    payload: ReservationAddonCreate,
    coach: Coach = Depends(require_coach),
    db: Session = Depends(get_db),
):
    """對應「加購臨時加人 (3b)」：僅教練身份會員可用，送出預約申請後另開的加購步驟。"""
    reservation = db.get(Reservation, payload.reservation_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到預約")
    if reservation.member_id != coach.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="僅能為自己的預約加購")

    addon = ReservationAddon(**payload.model_dump())
    db.add(addon)
    reservation.people_count += payload.extra_people
    db.commit()
    db.refresh(addon)
    return addon
