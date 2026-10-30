"""
體驗課詢問名單（見 docs/adr/0003-gym-website.md）：形象網站表單送出的資料，管理員跟進用。
訪客送出表單在 routers/site.py；這裡全部是管理員 API。
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from app.core.security import hash_password
from app.deps import get_db, require_perm
from app.models.coupon import Coupon, CouponSource
from app.models.inquiry import Inquiry, InquiryNote, InquiryStatus
from app.models.user import User, UserRole
from app.services import coupons as coupon_service
from app.services.coupons import CouponError
from app.schemas.inquiry import (
    InquiryConvert,
    InquiryNoteCreate,
    InquiryOut,
    InquiryStatusUpdate,
    InquirySummary,
)

# 後台功能權限（ADR 0008）：這個檔案的管理用 API 都屬於「inquiries」功能
require_access = require_perm("inquiries")

router = APIRouter(prefix="/inquiries", tags=["inquiries"], dependencies=[Depends(require_access)])


# 個資告知事項：未成為會員者最長保存 6 個月（schemas/website.py default_privacy_notice）
RETENTION_DAYS = 183


def purge_expired(db: Session) -> int:
    """刪除超過保存期限、且沒有成為會員的詢問（含跟進紀錄）。讀取名單時順便執行。"""
    cutoff = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
    expired = (
        db.query(Inquiry)
        .filter(Inquiry.created_at < cutoff, Inquiry.status != InquiryStatus.converted)
        .all()
    )
    for inquiry in expired:
        db.delete(inquiry)
    return len(expired)


def _get(db: Session, inquiry_id: int) -> Inquiry:
    inquiry = db.get(Inquiry, inquiry_id)
    if inquiry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到這筆詢問")
    return inquiry


@router.get("", response_model=list[InquiryOut])
def list_inquiries(
    status_filter: InquiryStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    if purge_expired(db):
        db.commit()
    query = db.query(Inquiry).options(selectinload(Inquiry.notes))
    if status_filter is not None:
        query = query.filter(Inquiry.status == status_filter)
    return query.order_by(Inquiry.created_at.desc(), Inquiry.id.desc()).all()


@router.get("/summary", response_model=InquirySummary)
def summary(db: Session = Depends(get_db)):
    """側欄徽章用：尚未處理的新詢問數。"""
    return InquirySummary(new_count=db.query(Inquiry).filter(Inquiry.status == InquiryStatus.new).count())


@router.patch("/{inquiry_id}", response_model=InquiryOut)
def update_status(inquiry_id: int, payload: InquiryStatusUpdate, db: Session = Depends(get_db)):
    inquiry = _get(db, inquiry_id)
    if payload.status == InquiryStatus.converted and inquiry.member_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="請用「建立會員帳號」轉成會員")
    inquiry.status = payload.status
    inquiry.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(inquiry)
    return inquiry


@router.post("/{inquiry_id}/notes", response_model=InquiryOut, status_code=status.HTTP_201_CREATED)
def add_note(
    inquiry_id: int,
    payload: InquiryNoteCreate,
    admin: User = Depends(require_access),
    db: Session = Depends(get_db),
):
    inquiry = _get(db, inquiry_id)
    db.add(InquiryNote(inquiry_id=inquiry.id, text=payload.text.strip(), created_by_name=admin.username))
    # 第一次跟進時自動從「新詢問」改為「聯絡中」
    if inquiry.status == InquiryStatus.new:
        inquiry.status = InquiryStatus.contacting
    inquiry.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(inquiry)
    return inquiry


@router.post("/{inquiry_id}/convert", response_model=InquiryOut)
def convert_to_member(
    inquiry_id: int,
    payload: InquiryConvert,
    admin: User = Depends(require_access),
    db: Session = Depends(get_db),
):
    """建立會員帳號並標記為「已成為會員」；密碼只回到後台畫面一次，由管理員交給對方。"""
    inquiry = _get(db, inquiry_id)
    if inquiry.member_user_id is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="這筆詢問已經建立過會員帳號")
    username = payload.username.strip()
    if db.query(User.id).filter(User.username == username).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="帳號已被使用，請換一個")
    user = User(
        username=username,
        password_hash=hash_password(payload.password),
        role=UserRole.member,
        must_change_password=payload.must_change_password,
    )
    db.add(user)
    db.flush()
    note = f"已建立會員帳號「{username}」"
    if payload.coupon_id is not None:
        # 轉為會員時同時送體驗券（ADR 0010）；發不了就整筆不成立
        coupon = db.get(Coupon, payload.coupon_id)
        if coupon is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到優惠券")
        try:
            coupon_service.issue(db, coupon, user, CouponSource.convert, admin.display_name or admin.username)
        except CouponError as err:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"體驗券：{err.message}")
        note += f"，並送「{coupon.name}」"
    inquiry.member_user_id = user.id
    inquiry.status = InquiryStatus.converted
    inquiry.updated_at = datetime.utcnow()
    db.add(
        InquiryNote(inquiry_id=inquiry.id, text=note, created_by_name=admin.username)
    )
    db.commit()
    db.refresh(inquiry)
    return inquiry
