from datetime import date, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_db
from app.services import line as line_service
from app.services import line_member
from app.services import staff_notifications
from app.deps import get_current_user, require_perm
from app.models.hour_ledger import HourLedger
from app.models.product import Product, ProductCategory
from app.models.purchase import PaymentMethod, PaymentStatus, Purchase
from app.models.user import User, UserRole
from app.schemas.purchase import (
    HourAdjustCreate,
    HourLedgerOut,
    PaymentConfirm,
    PurchaseCreate,
    PurchaseOut,
    PurchaseSelfCreate,
)
from app.services.staff import has_perm
from app.services import coupons as coupon_service
from app.services import hours
from app.services.coupons import CouponError

router = APIRouter(prefix="/purchases", tags=["purchases"])

# 後台功能權限（ADR 0008）：這個檔案的管理用 API 都屬於「purchases」功能
require_access = require_perm("purchases")


def _build_purchase(
    db: Session,
    *,
    user_id: int,
    product_id: int,
    quantity: int,
    purchase_date: date,
    amount: float,
    created_by: int,
    paid: bool,
    payment_method: PaymentMethod | None = None,
    payment_note: str | None = None,
) -> Purchase:
    """
    共用購買建立邏輯（「購買紀錄登錄」與會員「購買商品」皆走這裡）：
    - total_hours＝商品堂數 × 數量（用品為 0）；用品下單即扣減 products.stock（保留庫存）。
    - paid=True（管理員登錄）：狀態「已付款」並立即入帳堂數。
    - paid=False（會員自助購買）：狀態「待付款」，remaining_hours 為 0，待管理員確認收款才入帳。
    """
    member = db.get(User, user_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到會員")

    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到商品")

    if product.category == ProductCategory.supply:
        if product.stock is None or product.stock < quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="庫存不足")
        product.stock -= quantity
        total_hours = 0
    else:
        total_hours = product.session_hours * quantity

    purchase = Purchase(
        user_id=user_id,
        product_id=product_id,
        quantity=quantity,
        purchase_date=purchase_date,
        amount=amount,
        total_hours=total_hours,
        remaining_hours=0,
        payment_status=PaymentStatus.paid if paid else PaymentStatus.unpaid,
        payment_method=payment_method if paid else None,
        payment_note=payment_note if paid else None,
        paid_at=datetime.utcnow() if paid else None,
        paid_confirmed_by=created_by if paid else None,
        created_by=created_by,
    )
    db.add(purchase)
    if paid:
        hours.record_purchase(db, purchase, created_by=created_by)
    db.flush()
    return purchase


def _coupon_quote(db: Session, buyer: User, product_id: int, quantity: int, code: str | None, member_coupon_id: int | None):
    """有指定優惠券時由伺服器試算折後金額（R44）；沒有則回 None。"""
    if not coupon_service.normalize_code(code) and member_coupon_id is None:
        return None
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到商品")
    try:
        return coupon_service.quote(db, buyer, product, quantity, code=code, member_coupon_id=member_coupon_id)
    except CouponError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err.message)


def _apply_coupon(db: Session, buyer: User, quote, purchase: Purchase) -> None:
    if quote is None:
        return
    try:
        coupon_service.apply_to_purchase(db, buyer, quote, purchase)
    except CouponError as err:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err.message)


def _get_locked_purchase(db: Session, purchase_id: int) -> Purchase:
    purchase = hours.lock_purchase(db, purchase_id)
    if not purchase:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到購買紀錄")
    return purchase


@router.get("", response_model=list[PurchaseOut])
def list_purchases(
    user_id: int | None = None,
    payment_status: PaymentStatus | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    對應「教練購買紀錄查詢」（管理員，可用 user_id 篩選單一會員，購買對象不限教練身份）
    與「我的商品／庫存」（會員，僅能查詢自己的購買紀錄）。
    """
    query = db.query(Purchase)
    if current_user.role != UserRole.admin:
        query = query.filter(Purchase.user_id == current_user.id)
    elif user_id is not None:
        query = query.filter(Purchase.user_id == user_id)
    if payment_status is not None:
        query = query.filter(Purchase.payment_status == payment_status)
    return query.order_by(Purchase.created_at.desc(), Purchase.id.desc()).all()


@router.post("", response_model=PurchaseOut, status_code=status.HTTP_201_CREATED)
def create_purchase(payload: PurchaseCreate, admin: User = Depends(require_access), db: Session = Depends(get_db)):
    """
    對應「購買紀錄登錄」：選擇會員、選擇商品、數量、購買日期、金額、付款方式。
    管理員登錄即代表已收款，建立為「已付款」並立即入帳堂數。
    使用優惠券時金額改由後端計算（商品單價 × 數量 − 折抵）。
    """
    member = db.get(User, payload.user_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到會員")
    quote = _coupon_quote(db, member, payload.product_id, payload.quantity, payload.coupon_code, payload.member_coupon_id)
    purchase = _build_purchase(
        db,
        user_id=payload.user_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        purchase_date=payload.purchase_date,
        amount=float(quote.final) if quote else payload.amount,
        created_by=admin.id,
        paid=True,
        payment_method=payload.payment_method,
        payment_note=payload.payment_note,
    )
    _apply_coupon(db, member, quote, purchase)
    db.commit()
    db.refresh(purchase)
    return purchase


@router.post("/self", response_model=PurchaseOut, status_code=status.HTTP_201_CREATED)
def create_self_purchase(
    payload: PurchaseSelfCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    對應會員「購買商品」：登入會員為自己購買。歸屬對象一律為登入者本人，
    金額與購買日期由後端依商品單價 × 數量、當日日期帶入，不採用前端傳入值。
    建立為「待付款」，不入帳堂數，待管理員在「購買紀錄」確認收款。
    """
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到商品")
    if not product.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此商品未上架")

    quote = _coupon_quote(
        db, current_user, payload.product_id, payload.quantity, payload.coupon_code, payload.member_coupon_id
    )
    purchase = _build_purchase(
        db,
        user_id=current_user.id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        purchase_date=date.today(),
        amount=float(quote.final) if quote else float(product.price) * payload.quantity,
        created_by=current_user.id,
        paid=False,
    )
    # 優惠券（ADR 0010）：同一筆交易標成已使用；訂單取消時退回
    _apply_coupon(db, current_user, quote, purchase)
    # LINE 通知店家：有人下單、等待確認收款（docs/adr/0004-line-notifications.md）
    notification_id = line_service.notify_payment(db, purchase, product)
    # 後台鈴鐺通知（ADR 0009）
    staff_notifications.notify_order_unpaid(db, purchase, product)
    db.commit()
    line_service.schedule(background_tasks, notification_id)
    db.refresh(purchase)
    return purchase


@router.post("/{purchase_id}/confirm-payment", response_model=PurchaseOut)
def confirm_payment(
    purchase_id: int,
    payload: PaymentConfirm,
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_access),
    db: Session = Depends(get_db),
):
    """管理員確認會員訂單已收款：狀態改為「已付款」，並入帳購買的堂數。僅「待付款」可確認。"""
    purchase = _get_locked_purchase(db, purchase_id)
    if purchase.payment_status != PaymentStatus.unpaid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="僅待付款的訂單可確認收款")
    purchase.payment_status = PaymentStatus.paid
    purchase.payment_method = payload.payment_method
    purchase.payment_note = payload.payment_note
    purchase.paid_at = datetime.utcnow()
    purchase.paid_confirmed_by = admin.id
    hours.record_purchase(db, purchase, created_by=admin.id)
    # 從健身房官方帳號通知會員已收到款項（ADR 0005 第二階段）
    member_message_id = line_member.notify_payment_confirmed(db, purchase)
    db.commit()
    line_member.schedule(background_tasks, member_message_id)
    db.refresh(purchase)
    return purchase


@router.post("/{purchase_id}/cancel", response_model=PurchaseOut)
def cancel_purchase(
    purchase_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    取消尚未付款的訂單：管理員可取消任一筆，會員僅能取消自己的。
    用品訂單歸還下單時保留的庫存。已付款的訂單不可在此取消（退款流程尚未定義）。
    """
    purchase = _get_locked_purchase(db, purchase_id)
    if not has_perm(current_user, "purchases") and purchase.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到購買紀錄")
    if purchase.payment_status != PaymentStatus.unpaid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="僅待付款的訂單可取消")
    if purchase.product.category == ProductCategory.supply and purchase.product.stock is not None:
        purchase.product.stock += purchase.quantity
    purchase.payment_status = PaymentStatus.cancelled
    purchase.cancelled_at = datetime.utcnow()
    # 用掉的折價券退回「我的優惠券」（ADR 0010）
    coupon_service.release_for_purchase(db, purchase)
    db.commit()
    db.refresh(purchase)
    return purchase


@router.get("/{purchase_id}/ledger", response_model=list[HourLedgerOut])
def list_purchase_ledger(
    purchase_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """堂數異動紀錄：管理員可查任一筆，會員僅能查自己的購買紀錄。依時間排序。"""
    purchase = db.get(Purchase, purchase_id)
    if not purchase or (current_user.role != UserRole.admin and purchase.user_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到購買紀錄")
    return (
        db.query(HourLedger)
        .filter(HourLedger.purchase_id == purchase_id)
        .order_by(HourLedger.created_at, HourLedger.id)
        .all()
    )


@router.post("/{purchase_id}/adjust", response_model=HourLedgerOut, status_code=status.HTTP_201_CREATED)
def adjust_purchase_hours(
    purchase_id: int,
    payload: HourAdjustCreate,
    admin: User = Depends(require_perm("purchases", "members")),
    db: Session = Depends(get_db),
):
    """管理員手動調整剩餘堂數（正數補、負數扣），必須填寫原因，調整後不可小於 0。"""
    purchase = _get_locked_purchase(db, purchase_id)
    if purchase.payment_status != PaymentStatus.paid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="僅已付款的購買紀錄可調整堂數")
    entry = hours.adjust(db, purchase, payload.change, created_by=admin.id, note=payload.note)
    db.commit()
    db.refresh(entry)
    return entry
