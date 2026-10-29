"""
後台鈴鐺通知（ADR 0009、R40–R42）。

會員做了需要後台處理的事（送出預約、自己取消預約、下單待付款、網站體驗詢問）時，
在同一筆交易裡替「當下有對應功能權限、未停用」的每個後台帳號各寫一筆通知。
函式只 add / flush，由呼叫端 commit；通知內容只有姓名與摘要，不放電話、Email、備註。
"""

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.staff_notification import StaffNotification, StaffNotificationKind as Kind
from app.models.user import User, UserRole
from app.services.staff import has_perm

# 每種通知需要的功能權限：收件時判斷一次，讀取時再過濾一次（權限被拿掉就看不到）
KIND_PERM: dict[Kind, str] = {
    Kind.booking_submitted: "reservations",
    Kind.booking_cancelled: "reservations",
    Kind.order_unpaid: "purchases",
    Kind.inquiry_new: "inquiries",
}

RETENTION = timedelta(days=90)
WEEKDAY = "一二三四五六日"


def allowed_kinds(user: User) -> list[Kind]:
    return [k for k, perm in KIND_PERM.items() if has_perm(user, perm)]


def recipients(db: Session, kind: Kind, exclude_user_id: int | None = None) -> list[User]:
    staff = db.query(User).filter(User.role == UserRole.admin, User.is_active.is_(True)).order_by(User.id).all()
    return [u for u in staff if u.id != exclude_user_id and has_perm(u, KIND_PERM[kind])]


def notify(
    db: Session, kind: Kind, title: str, body: str, link: str, *, exclude_user_id: int | None = None
) -> int:
    """寫給所有收件人，回傳筆數。"""
    users = recipients(db, kind, exclude_user_id)
    for u in users:
        db.add(StaffNotification(user_id=u.id, kind=kind, title=title[:100], body=body[:300], link=link))
    if users:
        db.flush()
    return len(users)


def person(user: User | None) -> str:
    if user is None:
        return "會員"
    return user.display_name or user.username


def when(d: date, hour: int) -> str:
    return f"{d.month}/{d.day}（{WEEKDAY[d.weekday()]}）{hour:02d}:00"


def _booking_body(db: Session, reservation, item_name: str) -> str:
    from app.services.branches import label_for

    parts = [person(reservation.member), when(reservation.booking_date, reservation.start_hour), item_name]
    branch = label_for(db, reservation.branch_id)
    if branch:
        parts.append(branch)
    if reservation.people_count and reservation.people_count > 1:
        parts.append(f"{reservation.people_count} 人")
    return "・".join(parts)


def notify_booking_submitted(db: Session, reservation, item_name: str) -> int:
    return notify(
        db,
        Kind.booking_submitted,
        "新的預約，等待審核",
        _booking_body(db, reservation, item_name),
        f"/admin/reservations?highlight={reservation.id}",
        exclude_user_id=reservation.member_id,
    )


def notify_booking_cancelled(db: Session, reservation, item_name: str) -> int:
    title = "會員取消預約（晚取消，未退堂）" if reservation.late_cancel else "會員取消預約"
    return notify(
        db,
        Kind.booking_cancelled,
        title,
        _booking_body(db, reservation, item_name),
        f"/admin/reservations?highlight={reservation.id}",
        exclude_user_id=reservation.member_id,
    )


def notify_order_unpaid(db: Session, purchase, product) -> int:
    buyer = db.get(User, purchase.user_id)
    amount = float(purchase.amount)
    return notify(
        db,
        Kind.order_unpaid,
        "會員下單，等待確認收款",
        f"{person(buyer)}・{product.name} × {purchase.quantity}・NT$ {amount:,.0f}",
        f"/admin/purchases?highlight={purchase.id}",
        exclude_user_id=purchase.user_id,
    )


def notify_inquiry(db: Session, inquiry) -> int:
    parts = [inquiry.name]
    if inquiry.interest:
        parts.append(f"想體驗 {inquiry.interest}")
    if inquiry.preferred_slot:
        parts.append(inquiry.preferred_slot)
    return notify(db, Kind.inquiry_new, "新的體驗課詢問", "・".join(parts), f"/admin/inquiries?highlight={inquiry.id}")


def purge_expired(db: Session) -> None:
    """超過 90 天的通知直接刪除（列表時順手清，R42）。"""
    db.query(StaffNotification).filter(StaffNotification.created_at < datetime.utcnow() - RETENTION).delete(
        synchronize_session=False
    )
