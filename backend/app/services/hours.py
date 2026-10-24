"""
堂數帳務：所有 purchases.remaining_hours 的增減都必須經過這裡，
同時寫入一筆 hour_ledger，確保「SUM(ledger.delta) == remaining_hours」。

本模組的函式只 add / flush，不 commit——由呼叫端（路由）在整個操作完成後
統一 commit，讓「建立預約＋扣抵堂數」等多步驟操作成為單一交易，任一步失敗即整筆回滾。
"""

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.hour_ledger import HourLedger, HourLedgerReason
from app.models.product import ProductCategory
from app.models.purchase import PaymentStatus, Purchase
from app.models.reservation import Reservation

# 一筆預約（一個 60 分鐘時段）扣抵的堂數。1 堂＝1 小時，與 people_count 無關；
# 若日後改為「依人數扣抵」，只需調整 hours_for_reservation。
HOURS_PER_RESERVATION = Decimal("1")


def hours_for_reservation(reservation: Reservation) -> Decimal:
    return HOURS_PER_RESERVATION


def lock_purchase(db: Session, purchase_id: int) -> Purchase | None:
    """以 SELECT ... FOR UPDATE 取得購買紀錄，避免同時兩筆預約把同一筆堂數扣成負數（SQLite 會忽略）。"""
    return db.query(Purchase).filter(Purchase.id == purchase_id).with_for_update().first()


def _record(
    db: Session,
    purchase: Purchase,
    change: Decimal,
    reason: HourLedgerReason,
    *,
    reservation_id: int | None = None,
    created_by: int | None = None,
    note: str | None = None,
) -> HourLedger:
    new_balance = Decimal(purchase.remaining_hours) + change
    if new_balance < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="剩餘堂數不足")
    purchase.remaining_hours = new_balance
    entry = HourLedger(
        purchase_id=purchase.id,
        reservation_id=reservation_id,
        delta=change,
        balance_after=new_balance,
        reason=reason,
        note=note,
        created_by=created_by,
    )
    db.add(entry)
    return entry


def record_purchase(db: Session, purchase: Purchase, created_by: int) -> None:
    """
    已付款的購買入帳：把 total_hours 加進 remaining_hours，寫入一筆「購買」。
    在管理員登錄購買、或確認會員訂單收款時呼叫；用品（0 堂）不寫。
    """
    hours = Decimal(purchase.total_hours)
    if hours <= 0:
        return
    db.flush()  # 取得 purchase.id
    _record(db, purchase, hours, HourLedgerReason.purchase, created_by=created_by)


def deduct_for_reservation(db: Session, reservation: Reservation, created_by: int) -> None:
    """預約成立時扣抵所指定購買紀錄的堂數；未指定購買紀錄則不扣。"""
    if reservation.purchase_id is None:
        return
    purchase = lock_purchase(db, reservation.purchase_id)
    if purchase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到購買紀錄")
    if purchase.payment_status != PaymentStatus.paid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="購買紀錄尚未付款，無法扣抵")
    if purchase.user_id != reservation.member_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="購買紀錄不屬於該會員")
    if purchase.product.category == ProductCategory.supply:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用品購買紀錄無法扣抵堂數")
    if purchase.product_id != reservation.product_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="購買紀錄的商品與預約商品不符")
    db.flush()  # 取得 reservation.id
    _record(
        db,
        purchase,
        -hours_for_reservation(reservation),
        HourLedgerReason.reservation_deduct,
        reservation_id=reservation.id,
        created_by=created_by,
    )


def refund_reservation(db: Session, reservation: Reservation, created_by: int) -> None:
    """
    預約拒絕／取消時退回堂數。退回量＝該預約在帳上的淨扣抵量（取 ledger 加總），
    因此重複呼叫不會多退，也不會退回從未扣過的堂數。
    """
    if reservation.purchase_id is None:
        return
    net = (
        db.query(func.coalesce(func.sum(HourLedger.delta), 0))
        .filter(HourLedger.reservation_id == reservation.id)
        .scalar()
    )
    net = Decimal(net)
    if net >= 0:
        return
    purchase = lock_purchase(db, reservation.purchase_id)
    if purchase is None:
        return
    _record(
        db,
        purchase,
        -net,
        HourLedgerReason.reservation_refund,
        reservation_id=reservation.id,
        created_by=created_by,
    )


def adjust(db: Session, purchase: Purchase, change: Decimal, created_by: int, note: str) -> HourLedger:
    """管理員手動調整（補登、更正錯誤資料等），必須附註原因。"""
    return _record(db, purchase, change, HourLedgerReason.manual_adjust, created_by=created_by, note=note)
