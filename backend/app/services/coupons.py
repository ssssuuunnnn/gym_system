"""
體驗券與折價券（ADR 0010、R43–R47）。

- 發券（後台發放、LINE 新加入、轉為會員、會員輸入公開代碼領取）一律走 issue()：
  檢查啟用、期間、總張數、每人張數、新會員限定，並鎖住券設定避免超發。
- 折價券在購買方案時用：quote() 由伺服器計算折抵金額（不採用前端的金額），
  apply_to_purchase() 在同一筆交易把券標成已使用；訂單取消時 release_for_purchase() 退回。
- 體驗券用 redeem_trial() 換成一筆金額 0、已付款的購買紀錄（堂數照常入帳），
  設定「不計教練鐘點」時標記 payout_excluded。
函式只 add / flush，由呼叫端 commit。
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core import clock
from app.models.coupon import (
    Coupon,
    CouponKind,
    CouponSource,
    DiscountType,
    MemberCoupon,
    MemberCouponStatus,
)
from app.models.product import Product, ProductCategory
from app.models.purchase import PaymentMethod, PaymentStatus, Purchase
from app.models.user import User, UserRole
from app.services import hours


class CouponError(Exception):
    """不能發／不能用的原因（直接顯示給使用者）。"""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def today() -> date:
    return clock.now_local().date()


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def normalize_code(code: str | None) -> str | None:
    code = (code or "").strip().upper()
    return code or None


# ---------- 說明文字 ----------


def describe(coupon: Coupon) -> str:
    """一行看得懂的內容：折 300 元／85 折／送 私人課 單堂 1 堂。"""
    if coupon.kind == CouponKind.trial:
        product = coupon.trial_product
        if product is None:
            return "送體驗堂數"
        return f"送「{product.name}」{product.session_hours} 堂"
    value = Decimal(str(coupon.discount_value or 0))
    if coupon.discount_type == DiscountType.percent:
        rate = (Decimal(100) - value) / 10
        text = f"打 {rate.normalize():f} 折"
    else:
        text = f"折 {money(value):,} 元"
    if coupon.min_amount and Decimal(str(coupon.min_amount)) > 0:
        text = f"滿 {money(coupon.min_amount):,} 元{text}"
    return text


# ---------- 狀態 ----------


def is_expired(mc: MemberCoupon, on: date | None = None) -> bool:
    return mc.expires_on is not None and mc.expires_on < (on or today())


def display_status(mc: MemberCoupon) -> str:
    if mc.status == MemberCouponStatus.available and is_expired(mc):
        return "已過期"
    return mc.status.value


def _check_period(coupon: Coupon, on: date) -> None:
    if coupon.valid_from and on < coupon.valid_from:
        raise CouponError(f"這張券 {coupon.valid_from.month}/{coupon.valid_from.day} 起才能使用")
    if coupon.valid_until and on > coupon.valid_until:
        raise CouponError("這張券已經過期")


def is_new_member(db: Session, user: User) -> bool:
    """沒有付費購買紀錄（金額大於 0、沒有取消）的會員。"""
    paid = (
        db.query(Purchase.id)
        .filter(
            Purchase.user_id == user.id,
            Purchase.payment_status != PaymentStatus.cancelled,
            Purchase.amount > 0,
        )
        .first()
    )
    return paid is None


# ---------- 發券 ----------


def _lock(db: Session, coupon_id: int) -> Coupon | None:
    return db.query(Coupon).filter(Coupon.id == coupon_id).with_for_update().first()


def issue(
    db: Session, coupon: Coupon, user: User, source: CouponSource, issued_by_name: str | None = None
) -> MemberCoupon:
    """發一張券給會員。所有發券管道共用這裡的檢查。"""
    coupon = _lock(db, coupon.id) or coupon
    on = today()
    if not coupon.is_active:
        raise CouponError("這張券已停用")
    if user.role != UserRole.member:
        raise CouponError("只能發給會員")
    if coupon.valid_until and on > coupon.valid_until:
        raise CouponError("這張券已經過期")
    if coupon.new_member_only and not is_new_member(db, user):
        raise CouponError("這張券限新會員使用")
    issued = db.query(MemberCoupon).filter(
        MemberCoupon.coupon_id == coupon.id, MemberCoupon.status != MemberCouponStatus.void
    )
    if coupon.total_limit is not None and issued.count() >= coupon.total_limit:
        raise CouponError("這張券已經發完了")
    mine = issued.filter(MemberCoupon.user_id == user.id).count()
    if mine >= coupon.per_member_limit:
        raise CouponError("已經領過這張券了" if coupon.per_member_limit == 1 else f"每人限 {coupon.per_member_limit} 張")

    expires: date | None = coupon.valid_until
    if coupon.valid_days:
        by_days = on + timedelta(days=coupon.valid_days - 1)
        expires = min(expires, by_days) if expires else by_days
    mc = MemberCoupon(
        coupon_id=coupon.id,
        user_id=user.id,
        status=MemberCouponStatus.available,
        source=source,
        issued_by_name=issued_by_name,
        expires_on=expires,
    )
    mc.coupon = coupon
    db.add(mc)
    db.flush()
    return mc


def find_by_code(db: Session, code: str | None) -> Coupon:
    code = normalize_code(code)
    coupon = db.query(Coupon).filter(Coupon.code == code).first() if code else None
    if coupon is None:
        raise CouponError("找不到這個優惠代碼")
    return coupon


def claim(db: Session, user: User, code: str) -> MemberCoupon:
    """會員輸入公開代碼領取（放進「我的優惠券」）。"""
    return issue(db, find_by_code(db, code), user, CouponSource.code)


def auto_issue_on_line_join(db: Session, user: User) -> list[MemberCoupon]:
    """LINE 新加入會員：發所有設定「LINE 新加入自動發放」的體驗券（發不了的略過）。"""
    issued = []
    coupons = (
        db.query(Coupon)
        .filter(Coupon.kind == CouponKind.trial, Coupon.issue_on_line_join.is_(True), Coupon.is_active.is_(True))
        .order_by(Coupon.id)
        .all()
    )
    for coupon in coupons:
        try:
            issued.append(issue(db, coupon, user, CouponSource.line_join))
        except CouponError:
            continue
    return issued


# ---------- 折價券：購買時折抵 ----------


@dataclass
class Quote:
    original: Decimal
    discount: Decimal
    coupon: Coupon | None = None
    # 從「我的優惠券」挑的那張；用公開代碼時為 None（成立訂單時才領取）
    member_coupon: MemberCoupon | None = None
    code: str | None = None

    @property
    def final(self) -> Decimal:
        return max(self.original - self.discount, Decimal(0))


def _discount_for(coupon: Coupon, product: Product, original: Decimal) -> Decimal:
    if coupon.kind != CouponKind.discount:
        raise CouponError("體驗券不能用來折抵，請到「我的優惠券」使用")
    if coupon.product_ids and product.id not in coupon.product_ids:
        raise CouponError("這張券不適用這個方案")
    minimum = money(coupon.min_amount)
    if minimum > 0 and original < minimum:
        raise CouponError(f"滿 {minimum:,} 元才能使用")
    value = Decimal(str(coupon.discount_value or 0))
    if coupon.discount_type == DiscountType.percent:
        discount = money(original * value / 100)
    else:
        discount = money(value)
    return min(discount, original)


def _usable_member_coupon(db: Session, user: User, member_coupon_id: int) -> MemberCoupon:
    mc = (
        db.query(MemberCoupon)
        .filter(MemberCoupon.id == member_coupon_id, MemberCoupon.user_id == user.id)
        .with_for_update()
        .first()
    )
    if mc is None:
        raise CouponError("找不到這張優惠券")
    if mc.status == MemberCouponStatus.used:
        raise CouponError("這張券已經用過了")
    if mc.status == MemberCouponStatus.void:
        raise CouponError("這張券已作廢")
    if is_expired(mc):
        raise CouponError("這張券已經過期")
    _check_period(mc.coupon, today())
    return mc


def quote(
    db: Session,
    user: User,
    product: Product,
    quantity: int,
    *,
    code: str | None = None,
    member_coupon_id: int | None = None,
) -> Quote:
    """伺服器計算這張訂單的原價、折抵與應付金額（R44）。"""
    original = money(product.price) * quantity
    if member_coupon_id is not None:
        mc = _usable_member_coupon(db, user, member_coupon_id)
        return Quote(original, _discount_for(mc.coupon, product, original), mc.coupon, mc)
    if normalize_code(code):
        coupon = find_by_code(db, code)
        _check_period(coupon, today())
        if not coupon.is_active:
            raise CouponError("這張券已停用")
        discount = _discount_for(coupon, product, original)
        # 領取的條件（新會員限定、總張數、每人張數）在成立訂單時由 issue() 再檢查一次
        if coupon.new_member_only and not is_new_member(db, user):
            raise CouponError("這張券限新會員使用")
        return Quote(original, discount, coupon, None, normalize_code(code))
    return Quote(original, Decimal(0))


def apply_to_purchase(db: Session, user: User, q: Quote, purchase: Purchase) -> None:
    """訂單成立：記下原價與折抵，並把券標成已使用（用公開代碼時同時領取）。"""
    if q.coupon is None:
        return
    mc = q.member_coupon or issue(db, q.coupon, user, CouponSource.code)
    mc.status = MemberCouponStatus.used
    mc.used_at = datetime.utcnow()
    mc.purchase_id = purchase.id
    purchase.original_amount = float(q.original)
    purchase.discount_amount = float(q.discount)


def release_for_purchase(db: Session, purchase: Purchase) -> None:
    """待付款訂單取消：用掉的折價券退回「可使用」（過期的仍會顯示為已過期）。"""
    for mc in db.query(MemberCoupon).filter(
        MemberCoupon.purchase_id == purchase.id, MemberCoupon.status == MemberCouponStatus.used
    ):
        mc.status = MemberCouponStatus.available
        mc.used_at = None
        mc.purchase_id = None


# ---------- 體驗券：送堂數 ----------


def redeem_trial(db: Session, user: User, member_coupon_id: int) -> Purchase:
    """使用體驗券：建立金額 0、已付款的購買紀錄並入帳堂數（R45）。"""
    mc = _usable_member_coupon(db, user, member_coupon_id)
    coupon = mc.coupon
    if coupon.kind != CouponKind.trial:
        raise CouponError("折價券請在購買方案時使用")
    product = coupon.trial_product
    if product is None or product.category == ProductCategory.supply:
        raise CouponError("這張體驗券沒有設定可用的方案，請洽櫃台")
    purchase = Purchase(
        user_id=user.id,
        product_id=product.id,
        quantity=1,
        purchase_date=today(),
        amount=0,
        original_amount=float(money(product.price)),
        discount_amount=float(money(product.price)),
        total_hours=product.session_hours,
        remaining_hours=0,
        payment_status=PaymentStatus.paid,
        payment_method=PaymentMethod.coupon,
        payment_note=coupon.name[:255],
        paid_at=datetime.utcnow(),
        paid_confirmed_by=user.id,
        created_by=user.id,
        payout_excluded=not coupon.counts_for_payout,
    )
    db.add(purchase)
    db.flush()
    hours.record_purchase(db, purchase, created_by=user.id)
    mc.status = MemberCouponStatus.used
    mc.used_at = datetime.utcnow()
    mc.purchase_id = purchase.id
    db.flush()
    return purchase


def void(mc: MemberCoupon, reason: str | None) -> None:
    if mc.status != MemberCouponStatus.available:
        raise CouponError("只有還沒使用的券可以作廢")
    mc.status = MemberCouponStatus.void
    mc.voided_at = datetime.utcnow()
    mc.void_reason = (reason or "").strip()[:100] or None
