"""
體驗券與折價券（ADR 0010、R43–R47）。

後台（功能權限「優惠券」）：建立／編輯／停用券、發給指定會員、看發放紀錄、作廢。
會員：我的優惠券、輸入公開代碼領取、使用體驗券（換成堂數）。
結帳試算（/quote、/usable）會員與有「購買紀錄」權限的後台帳號共用；金額一律由伺服器計算。
"""

from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, require_perm
from app.models.coupon import Coupon, CouponKind, CouponSource, MemberCoupon, MemberCouponStatus
from app.models.product import Product, ProductCategory
from app.models.user import User, UserRole
from app.schemas.coupon import (
    CouponClaimIn,
    CouponIn,
    CouponIssueIn,
    CouponIssueOut,
    CouponIssueSkip,
    CouponOption,
    CouponOut,
    CouponVoidIn,
    MemberCouponOut,
    QuoteIn,
    QuoteOut,
    UsableCoupon,
)
from app.schemas.purchase import PurchaseOut
from app.services import coupons as svc
from app.services.coupons import CouponError
from app.services.staff import has_perm

router = APIRouter(prefix="/coupons", tags=["coupons"])

# 後台功能權限（ADR 0008）：管理優惠券屬於「coupons」功能
require_access = require_perm("coupons")


def _bad(err: CouponError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err.message)


def _person(user: User | None) -> str:
    return (user.display_name or user.username) if user else ""


def member_coupon_out(mc: MemberCoupon) -> MemberCouponOut:
    c = mc.coupon
    return MemberCouponOut(
        id=mc.id,
        coupon_id=c.id,
        user_id=mc.user_id,
        member_name=_person(mc.user),
        name=c.name,
        kind=c.kind,
        description=c.description,
        summary=svc.describe(c),
        status=svc.display_status(mc),
        source=mc.source,
        issued_by_name=mc.issued_by_name,
        issued_at=mc.issued_at,
        expires_on=mc.expires_on,
        used_at=mc.used_at,
        purchase_id=mc.purchase_id,
        void_reason=mc.void_reason,
        product_ids=list(c.product_ids or []),
        trial_product_id=c.trial_product_id,
        min_amount=float(c.min_amount or 0),
    )


def _coupon_out(db: Session, coupon: Coupon) -> CouponOut:
    counts = dict(
        db.query(MemberCoupon.status, func.count(MemberCoupon.id))
        .filter(MemberCoupon.coupon_id == coupon.id)
        .group_by(MemberCoupon.status)
        .all()
    )
    out = CouponOut.model_validate(coupon)
    out.summary = svc.describe(coupon)
    out.issued_count = sum(n for s, n in counts.items() if s != MemberCouponStatus.void)
    out.used_count = counts.get(MemberCouponStatus.used, 0)
    return out


def _get(db: Session, coupon_id: int) -> Coupon:
    coupon = db.get(Coupon, coupon_id)
    if coupon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到優惠券")
    return coupon


def _check_products(db: Session, payload: CouponIn) -> None:
    if payload.trial_product_id is not None:
        product = db.get(Product, payload.trial_product_id)
        if product is None or product.category == ProductCategory.supply:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="體驗券要選擇課程類的方案")
    if payload.product_ids:
        found = {pid for (pid,) in db.query(Product.id).filter(Product.id.in_(payload.product_ids))}
        if found != set(payload.product_ids):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="適用方案有不存在的項目")


def _save(db: Session, coupon: Coupon) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="這個代碼已經有其他券在用了")
    db.refresh(coupon)


# ---------- 會員：我的優惠券 ----------


@router.get("/mine", response_model=list[MemberCouponOut])
def my_coupons(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(MemberCoupon)
        .filter(MemberCoupon.user_id == current_user.id, MemberCoupon.status != MemberCouponStatus.void)
        .order_by(MemberCoupon.issued_at.desc(), MemberCoupon.id.desc())
        .all()
    )
    return [member_coupon_out(mc) for mc in rows]


@router.post("/claim", response_model=MemberCouponOut, status_code=status.HTTP_201_CREATED)
def claim_coupon(payload: CouponClaimIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """輸入公開代碼，把券領進「我的優惠券」。"""
    if current_user.role != UserRole.member:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="只有會員可以領取優惠券")
    try:
        mc = svc.claim(db, current_user, payload.code)
    except CouponError as err:
        raise _bad(err)
    db.commit()
    db.refresh(mc)
    return member_coupon_out(mc)


@router.post("/mine/{member_coupon_id}/redeem", response_model=PurchaseOut, status_code=status.HTTP_201_CREATED)
def redeem_trial(member_coupon_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """使用體驗券：換成一筆金額 0、已付款的購買紀錄，堂數馬上可以預約。"""
    try:
        purchase = svc.redeem_trial(db, current_user, member_coupon_id)
    except CouponError as err:
        raise _bad(err)
    db.commit()
    db.refresh(purchase)
    return purchase


# ---------- 結帳試算（會員自己；後台替會員） ----------


def _buyer(db: Session, current_user: User, user_id: int | None) -> User:
    if current_user.role != UserRole.admin:
        return current_user
    if not has_perm(current_user, "purchases", "coupons"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="沒有「購買紀錄」的權限")
    member = db.get(User, user_id) if user_id else None
    if member is None or member.role != UserRole.member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到會員")
    return member


def _product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到商品")
    return product


@router.post("/quote", response_model=QuoteOut)
def quote(payload: QuoteIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    buyer = _buyer(db, current_user, payload.user_id)
    product = _product(db, payload.product_id)
    try:
        q = svc.quote(db, buyer, product, payload.quantity, code=payload.code, member_coupon_id=payload.member_coupon_id)
    except CouponError as err:
        raise _bad(err)
    finally:
        db.rollback()  # 試算不留下任何鎖或變更
    return QuoteOut(
        original=float(q.original),
        discount=float(q.discount),
        final=float(q.final),
        coupon_name=q.coupon.name if q.coupon else None,
        member_coupon_id=q.member_coupon.id if q.member_coupon else None,
    )


@router.get("/usable", response_model=list[UsableCoupon])
def usable_coupons(
    product_id: int,
    quantity: int = Query(default=1, ge=1),
    user_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """結帳時列出這位會員手上可以用的折價券，並算好各能折多少（最划算的排前面）。"""
    buyer = _buyer(db, current_user, user_id)
    product = _product(db, product_id)
    rows = (
        db.query(MemberCoupon)
        .join(Coupon)
        .filter(
            MemberCoupon.user_id == buyer.id,
            MemberCoupon.status == MemberCouponStatus.available,
            Coupon.kind == CouponKind.discount,
        )
        .all()
    )
    original = svc.money(product.price) * quantity
    result = []
    for mc in rows:
        if svc.is_expired(mc):
            continue
        try:
            svc._check_period(mc.coupon, svc.today())
            discount = svc._discount_for(mc.coupon, product, original)
            result.append(UsableCoupon(member_coupon=member_coupon_out(mc), usable=True, discount=float(discount),
                                       final=float(max(original - discount, Decimal(0))), reason=None))
        except CouponError as err:
            result.append(UsableCoupon(member_coupon=member_coupon_out(mc), usable=False, discount=0,
                                       final=float(original), reason=err.message))
    result.sort(key=lambda u: (not u.usable, -u.discount, u.member_coupon.expires_on or datetime.max.date()))
    return result


# ---------- 後台 ----------


@router.get("/options", response_model=list[CouponOption])
def coupon_options(
    kind: CouponKind | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """啟用中的券（詢問轉會員時選體驗券用）。"""
    if not has_perm(current_user, "coupons", "inquiries", "members"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="沒有「優惠券」的權限")
    query = db.query(Coupon).filter(Coupon.is_active.is_(True))
    if kind is not None:
        query = query.filter(Coupon.kind == kind)
    today = svc.today()
    rows = [c for c in query.order_by(Coupon.id.desc()).all() if not c.valid_until or c.valid_until >= today]
    return [CouponOption(id=c.id, name=c.name, kind=c.kind, summary=svc.describe(c)) for c in rows]


@router.get("", response_model=list[CouponOut], dependencies=[Depends(require_access)])
def list_coupons(db: Session = Depends(get_db)):
    return [_coupon_out(db, c) for c in db.query(Coupon).order_by(Coupon.is_active.desc(), Coupon.id.desc()).all()]


@router.post("", response_model=CouponOut, status_code=status.HTTP_201_CREATED)
def create_coupon(payload: CouponIn, current_user: User = Depends(require_access), db: Session = Depends(get_db)):
    _check_products(db, payload)
    coupon = Coupon(**payload.model_dump(), created_by_name=_person(current_user))
    db.add(coupon)
    _save(db, coupon)
    return _coupon_out(db, coupon)


# 已經發出去的券不能再改這些（改了會讓會員手上的券內容變掉）
LOCKED_FIELDS = ("kind", "discount_type", "discount_value", "trial_product_id")


@router.put("/{coupon_id}", response_model=CouponOut, dependencies=[Depends(require_access)])
def update_coupon(coupon_id: int, payload: CouponIn, db: Session = Depends(get_db)):
    coupon = _get(db, coupon_id)
    _check_products(db, payload)
    data = payload.model_dump()
    issued = db.query(MemberCoupon.id).filter(MemberCoupon.coupon_id == coupon.id).first() is not None
    if issued:
        for field in LOCKED_FIELDS:
            current = getattr(coupon, field)
            new = data[field]
            if field == "discount_value" and current is not None and new is not None:
                same = Decimal(str(current)) == Decimal(str(new))
            else:
                same = current == new
            if not same:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="這張券已經發出去了，不能改類型、折扣或送的方案；請停用後另建一張",
                )
    for key, value in data.items():
        setattr(coupon, key, value)
    coupon.updated_at = datetime.utcnow()
    _save(db, coupon)
    return _coupon_out(db, coupon)


@router.post("/{coupon_id}/issue", response_model=CouponIssueOut)
def issue_coupon(
    coupon_id: int, payload: CouponIssueIn, current_user: User = Depends(require_access), db: Session = Depends(get_db)
):
    """發給指定會員；不符合條件的會員略過並列出原因，其他人照發。"""
    coupon = _get(db, coupon_id)
    issued, skipped = 0, []
    for user_id in dict.fromkeys(payload.user_ids):
        user = db.get(User, user_id)
        if user is None or user.role != UserRole.member:
            skipped.append(CouponIssueSkip(user_id=user_id, name=f"#{user_id}", reason="不是會員"))
            continue
        try:
            with db.begin_nested():
                svc.issue(db, coupon, user, CouponSource.staff, _person(current_user))
            issued += 1
        except CouponError as err:
            skipped.append(CouponIssueSkip(user_id=user.id, name=_person(user), reason=err.message))
    db.commit()
    return CouponIssueOut(issued=issued, skipped=skipped)


@router.get("/{coupon_id}/member-coupons", response_model=list[MemberCouponOut], dependencies=[Depends(require_access)])
def coupon_usage(coupon_id: int, db: Session = Depends(get_db)):
    _get(db, coupon_id)
    rows = (
        db.query(MemberCoupon)
        .filter(MemberCoupon.coupon_id == coupon_id)
        .order_by(MemberCoupon.issued_at.desc(), MemberCoupon.id.desc())
        .all()
    )
    return [member_coupon_out(mc) for mc in rows]


@router.post("/member-coupons/{member_coupon_id}/void", response_model=MemberCouponOut, dependencies=[Depends(require_access)])
def void_member_coupon(member_coupon_id: int, payload: CouponVoidIn, db: Session = Depends(get_db)):
    mc = db.get(MemberCoupon, member_coupon_id)
    if mc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到這張券")
    try:
        svc.void(mc, payload.reason)
    except CouponError as err:
        raise _bad(err)
    db.commit()
    db.refresh(mc)
    return member_coupon_out(mc)
