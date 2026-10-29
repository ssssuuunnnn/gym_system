from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.deps import get_db
from app.services import line as line_service
from app.services import line_member
from app.services import staff_notifications
from app.deps import get_coach_profile, get_current_user, require_perm, require_coach
from app.models.coach import Coach
from app.models.course import Course
from app.models.product import Product
from app.models.reservation import (
    Attendance,
    Reservation,
    ReservationAddon,
    ReservationSource,
    ReservationStatus,
)
from app.models.branch import Branch
from app.models.time_slot import TimeSlot
from app.models.user import User, UserRole
from app.schemas.reservation import (
    AttendanceMark,
    CoachingReservationOut,
    ReservationAddonCreate,
    ReservationAddonOut,
    ReservationCancel,
    ReservationCreate,
    ReservationOut,
    ReservationReview,
    ReservationUpdate,
)
from app.services import booking_rules, hours
from app.services.staff import has_perm
from app.services import branches as branch_service

router = APIRouter(prefix="/reservations", tags=["reservations"])

# 後台功能權限（ADR 0008）：這個檔案的管理用 API 都屬於「reservations」功能
require_access = require_perm("reservations")

def _check_slot_open(db: Session, branch_id: int, slot_date, start_hour: int) -> None:
    """公休各分店獨立（R34）：只看這間分店的設定。"""
    slot = (
        db.query(TimeSlot)
        .filter(TimeSlot.branch_id == branch_id, TimeSlot.slot_date == slot_date, TimeSlot.start_hour == start_hour)
        .first()
    )
    # 尚未建立紀錄視為預設開放；已建立且 is_open=False 則不可預約（管理員建立預約亦受此限制）。
    if slot is not None and not slot.is_open:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="該時段已被管理員關閉，無法預約")


def _resolve_branch(db: Session, payload: ReservationCreate, product: Product) -> Branch:
    """
    預約的分店（R34–R35）：團體課跟著課程；私人課用會員選的分店（省略＝預設分店）。
    指定的教練要在這間分店授課；限定分店的方案只能在那些分店使用。
    """
    course_id = payload.course_id or product.course_id
    course = db.get(Course, course_id) if course_id else None
    if course is not None:
        branch = course.branch
    else:
        branch = branch_service.active_branch(db, payload.branch_id)
        if payload.coach_id is not None:
            coach = db.get(Coach, payload.coach_id)
            if coach is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="找不到教練")
            if branch.id not in coach.branch_ids:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"這位教練不在「{branch.name}」授課")
    if product.branch_ids and branch.id not in product.branch_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"這個方案不能在「{branch.name}」使用")
    return branch


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
    branch_id: int | None = None,
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
    if branch_id is not None:
        query = query.filter(Reservation.branch_id == branch_id)
    return query.order_by(Reservation.booking_date, Reservation.start_hour).all()


def _item_name(db: Session, reservation: Reservation) -> str:
    """通知上顯示的課程／方案名稱：團體課用課程名稱，其餘用商品名稱。"""
    if reservation.course_id:
        course = db.get(Course, reservation.course_id)
        if course:
            return course.name
    product = db.get(Product, reservation.product_id) if reservation.product_id else None
    return product.name if product else "預約"


@router.post("", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation(
    payload: ReservationCreate,
    background_tasks: BackgroundTasks,
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

    branch = _resolve_branch(db, payload, product)
    _check_slot_open(db, branch.id, payload.booking_date, payload.start_hour)

    if as_admin:
        require_access(current_user)
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
    payload_data["branch_id"] = branch.id

    reservation = Reservation(
        **payload_data,
        source=source,
        status=initial_status,
    )
    db.add(reservation)
    # 建立預約與扣抵堂數同一交易：堂數不足或購買紀錄不符時整筆回滾，不會留下沒扣到堂數的預約。
    hours.deduct_for_reservation(db, reservation, created_by=current_user.id)
    notification_id = None
    if not as_admin:
        # LINE 通知店家：有預約等待審核（docs/adr/0004-line-notifications.md）
        db.flush()
        course = db.get(Course, reservation.course_id) if reservation.course_id else None
        item_name = course.name if course else product.name
        notification_id = line_service.notify_booking(db, reservation, item_name)
        # 後台鈴鐺通知（ADR 0009）
        staff_notifications.notify_booking_submitted(db, reservation, item_name)
    member_message_id = None
    if as_admin and reservation.member_id != current_user.id:
        # 櫃台幫會員預約：從健身房官方帳號通知會員（ADR 0005 第二階段）
        db.flush()
        member_message_id = line_member.notify_booking_result(db, reservation)
    db.commit()
    line_service.schedule(background_tasks, notification_id)
    line_member.schedule(background_tasks, member_message_id)
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

    if not has_perm(current_user, "reservations") and reservation.member_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="僅能編輯自己的預約")

    if reservation.status != ReservationStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="僅待確認狀態可編輯")

    new_booking_date = payload.booking_date if payload.booking_date is not None else reservation.booking_date
    new_start_hour = payload.start_hour if payload.start_hour is not None else reservation.start_hour
    _check_slot_open(db, reservation.branch_id, new_booking_date, new_start_hour)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(reservation, field, value)

    db.commit()
    db.refresh(reservation)
    return reservation


@router.post("/{reservation_id}/review", response_model=ReservationOut, dependencies=[Depends(require_access)])
def review_reservation(
    reservation_id: int,
    payload: ReservationReview,
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_access),
    db: Session = Depends(get_db),
):
    """
    對應「預約審核列表／詳情」：核准／拒絕。核准前需再次確認容量。
    堂數已在送出申請時扣抵；拒絕時退回。僅待確認的預約可審核。
    """
    reservation = db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到預約")
    if reservation.status != ReservationStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="僅待確認的預約可審核")
    if payload.status not in (ReservationStatus.confirmed, ReservationStatus.rejected):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="審核結果只能是已確認或已拒絕")

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

    if payload.status == ReservationStatus.rejected:
        hours.refund_reservation(db, reservation, created_by=admin.id)

    reservation.status = payload.status
    reservation.reviewed_by = admin.id
    reservation.reviewed_at = datetime.utcnow()
    member_message_id = line_member.notify_booking_result(db, reservation)
    db.commit()
    line_member.schedule(background_tasks, member_message_id)
    db.refresh(reservation)
    return reservation


@router.post("/{reservation_id}/cancel", response_model=ReservationOut)
def cancel_reservation(
    reservation_id: int,
    background_tasks: BackgroundTasks,
    payload: ReservationCancel | None = Body(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    對應「預約審核列表」取消按鈕（管理員）與「我的預約」取消（會員／教練自助取消自己的
    待確認／已確認預約）。

    取消期限（R8）：已確認的預約在開課前 N 小時內（系統設定 cancel_deadline_hours）取消，
    仍可取消但不退堂，並標記 late_cancel。會員在已確認課程開始後不能自行取消（應由教練／管理員標記未到）。
    管理員可用 payload.refund 覆寫是否退堂。已標記出席狀態的預約不能取消。
    """
    reservation = db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到預約")

    is_admin = has_perm(current_user, "reservations")
    if not is_admin and reservation.member_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="僅能取消自己的預約")

    if reservation.status not in (ReservationStatus.pending, ReservationStatus.confirmed):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此預約狀態無法取消")
    if reservation.attendance is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="已標記出席狀態的預約無法取消")
    if (
        not is_admin
        and reservation.status == ReservationStatus.confirmed
        and booking_rules.has_started(reservation)
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="課程已開始，無法取消")

    late = booking_rules.is_late_cancel(db, reservation)
    refund = not late
    if is_admin and payload is not None and payload.refund is not None:
        refund = payload.refund

    reservation.status = ReservationStatus.cancelled
    reservation.cancelled_at = datetime.utcnow()
    reservation.late_cancel = late

    if refund:
        hours.refund_reservation(db, reservation, created_by=current_user.id)

    member_message_id = None
    if is_admin and reservation.member_id != current_user.id:
        # 櫃台取消：通知會員（會員自己取消的不發）
        member_message_id = line_member.notify_booking_cancelled(db, reservation, refunded=refund)
    if reservation.member_id == current_user.id:
        # 會員自己取消：後台鈴鐺通知（ADR 0009）
        staff_notifications.notify_booking_cancelled(db, reservation, _item_name(db, reservation))
    db.commit()
    line_member.schedule(background_tasks, member_message_id)
    db.refresh(reservation)
    return reservation


@router.get("/coaching", response_model=list[CoachingReservationOut])
def list_coaching_reservations(coach: Coach = Depends(require_coach), db: Session = Depends(get_db)):
    """
    教練簽到用：列出由此教練帶的已確認預約——預約指定此教練，或預約的團體課程由此教練授課。
    不含教練本人以會員身份的預約（那些在「我的預約」）。
    """
    rows = (
        db.query(Reservation)
        .outerjoin(Course, Reservation.course_id == Course.id)
        .filter(
            Reservation.status == ReservationStatus.confirmed,
            Reservation.member_id != coach.user_id,
            or_(Reservation.coach_id == coach.id, Course.coach_id == coach.id),
        )
        .order_by(Reservation.booking_date, Reservation.start_hour)
        .all()
    )
    return [
        CoachingReservationOut(
            **ReservationOut.model_validate(r).model_dump(), member_username=r.member.username
        )
        for r in rows
    ]


def _is_coach_of(db: Session, user: User, reservation: Reservation) -> bool:
    coach = get_coach_profile(user, db)
    if coach is None:
        return False
    if reservation.coach_id == coach.id:
        return True
    if reservation.course_id is not None:
        course = db.get(Course, reservation.course_id)
        return course is not None and course.coach_id == coach.id
    return False


@router.post("/{reservation_id}/attendance", response_model=ReservationOut)
def mark_attendance(
    reservation_id: int,
    payload: AttendanceMark,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    簽到／標記未到（R9、R10）。僅「已確認」的預約可標記；已出席與未到都不退堂。
    - 管理員、該預約的教練：開課前 30 分鐘起可標記已出席／未到（之後可補登或更正）；「未到」需開課後。
    - 學員本人：只能在開課前 30 分鐘到下課之間標記自己「已出席」，標記後不能自行更改。
    """
    reservation = db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到預約")

    is_staff = has_perm(current_user, "reservations") or _is_coach_of(db, current_user, reservation)
    is_self = reservation.member_id == current_user.id
    if not is_staff and not is_self:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="無權為此預約簽到")

    if reservation.status != ReservationStatus.confirmed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="僅已確認的預約可簽到")

    if is_staff:
        if not booking_rules.staff_check_in_open(reservation):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="尚未到簽到時間（開課前 30 分鐘起）")
        if payload.attendance == Attendance.no_show and not booking_rules.has_started(reservation):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="課程開始後才能標記未到")
    else:
        if payload.attendance != Attendance.attended:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="學員只能為自己簽到")
        if reservation.attendance is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此預約已標記出席狀態")
        if not booking_rules.self_check_in_open(db, reservation):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="只能在開課前 30 分鐘到下課之間簽到"
            )

    reservation.attendance = payload.attendance
    reservation.checked_in_at = datetime.utcnow()
    reservation.checked_in_by = current_user.id
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
