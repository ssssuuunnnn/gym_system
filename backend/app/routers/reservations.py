from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_current_user, require_admin, require_coach
from app.models.coach import Coach
from app.models.product import Product, ProductCategory
from app.models.purchase import Purchase
from app.models.reservation import (
    Reservation,
    ReservationAddon,
    ReservationSource,
    ReservationStatus,
)
from app.models.time_slot import TimeSlot
from app.models.user import User
from app.schemas.reservation import (
    ReservationAddonCreate,
    ReservationAddonOut,
    ReservationCreate,
    ReservationOut,
    ReservationReview,
)

router = APIRouter(prefix="/reservations", tags=["reservations"])

# 容量上限，對應「共用元件」時段選擇器規格：私人教練 x/4、團體課 x/1、包場 x/1
CAPACITY_BY_CATEGORY = {
    ProductCategory.private_1v1: 4,
    ProductCategory.private_1v2: 4,
    ProductCategory.rental_1v1: 4,
    ProductCategory.group_class: 1,
    ProductCategory.buyout: 1,
}


def _check_slot_open(db: Session, day_of_week: int, start_hour: int) -> None:
    slot = (
        db.query(TimeSlot)
        .filter(TimeSlot.day_of_week == day_of_week, TimeSlot.start_hour == start_hour)
        .first()
    )
    # 尚未建立紀錄視為預設開放；已建立且 is_open=False 則不可預約（管理員建立預約亦受此限制）。
    if slot is not None and not slot.is_open:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="該時段已被管理員關閉，無法預約")


def _check_capacity(db: Session, product: Product, booking_date, start_hour: int) -> None:
    limit = CAPACITY_BY_CATEGORY.get(product.category)
    if limit is None:
        return

    existing_count = (
        db.query(Reservation)
        .join(Product, Reservation.product_id == Product.id)
        .filter(
            Reservation.booking_date == booking_date,
            Reservation.start_hour == start_hour,
            Reservation.status == ReservationStatus.confirmed,
            Product.category == product.category,
        )
        .count()
    )
    if existing_count >= limit:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="該時段容量已滿")


@router.get("", response_model=list[ReservationOut])
def list_reservations(
    member_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """對應「預約審核列表」（管理員，看全部）與「我的預約列表」（會員，帶 member_id 篩選自己）。"""
    query = db.query(Reservation)
    if member_id is not None:
        query = query.filter(Reservation.member_id == member_id)
    return query.order_by(Reservation.booking_date, Reservation.start_hour).all()


@router.post("", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation(
    payload: ReservationCreate,
    as_admin: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    as_admin=true 時對應「管理員建立預約」（source=admin_created，狀態直接為已確認，
    仍須通過 time_slots 開放檢查）；否則對應「送出預約申請」（source=member_submitted，
    狀態為待確認）。
    """
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到商品")

    _check_slot_open(db, payload.booking_date.isoweekday(), payload.start_hour)

    if as_admin:
        require_admin(current_user)
        source = ReservationSource.admin_created
        initial_status = ReservationStatus.confirmed
        _check_capacity(db, product, payload.booking_date, payload.start_hour)
    else:
        source = ReservationSource.member_submitted
        initial_status = ReservationStatus.pending

    reservation = Reservation(
        **payload.model_dump(),
        source=source,
        status=initial_status,
    )
    db.add(reservation)
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
        _check_capacity(db, product, reservation.booking_date, reservation.start_hour)

    reservation.status = payload.status
    reservation.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(reservation)
    return reservation


@router.post("/{reservation_id}/cancel", response_model=ReservationOut, dependencies=[Depends(require_admin)])
def cancel_reservation(reservation_id: int, db: Session = Depends(get_db)):
    """
    對應「預約審核列表」取消按鈕：教練口頭／通知管理員取消後，由管理員在此操作
    （非教練端自助取消）。
    """
    reservation = db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到預約")

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
