from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.deps import get_db
from app.deps import require_admin, require_perm
from app.models.coach import Coach
from app.models.user import User, UserRole
from app.services.members import clear_line_link, normalize_phone
from app.schemas.user import (
    UserBlacklistUpdate,
    UserOut,
    UserResetPassword,
    UserUpdate,
    user_out,
)

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])

# 後台功能權限（ADR 0008）：會員清單也是好幾個功能的下拉選單來源，讀取開給這些功能；修改只給「會員管理」
require_read = require_perm(
    "members", "reservations", "purchases", "coaches", "segments", "inquiries", "payouts", "dashboard"
)
require_edit = require_perm("members")


def _member(db: Session, user_id: int) -> User:
    """這裡只處理會員帳號；後台帳號由「後台帳號」（routers/staff.py）管理，避免繞過權限重設管理者密碼。"""
    member = db.get(User, user_id)
    if not member or member.role != UserRole.member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到會員")
    return member


def _to_out(member: User, db: Session) -> UserOut:
    coach = db.query(Coach).filter(Coach.user_id == member.id).first()
    return user_out(member, coach is not None)


@router.get("", response_model=list[UserOut], dependencies=[Depends(require_read)])
def list_members(db: Session = Depends(get_db)):
    """
    對應「會員列表」：帳號、姓名、身份（學員／場租教練）、加入時間、最後操作時間、黑名單狀態。
    身份為衍生值：coaches 是否存在該 user_id 綁定紀錄。
    """
    members = db.query(User).filter(User.role == UserRole.member).all()
    coach_user_ids = {c.user_id for c in db.query(Coach.user_id).all()}
    return [user_out(m, m.id in coach_user_ids) for m in members]


@router.get("/{user_id}", response_model=UserOut, dependencies=[Depends(require_read)])
def get_member(user_id: int, db: Session = Depends(get_db)):
    """對應「會員詳情」。"""
    member = _member(db, user_id)
    return _to_out(member, db)


@router.put("/{user_id}", response_model=UserOut, dependencies=[Depends(require_edit)])
def update_member(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    """對應「會員詳情」會員資料卡：帳號（系統內唯一）、姓名、手機；只更新有送出的欄位。"""
    member = _member(db, user_id)

    data = payload.model_dump(exclude_unset=True)
    if "username" in data:
        username = (data["username"] or "").strip()
        if not username:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="帳號不可空白")
        taken = db.query(User).filter(User.username == username, User.id != user_id).first()
        if taken:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="帳號已被使用")
        member.username = username
    if "display_name" in data:
        member.display_name = (data["display_name"] or "").strip() or None
    if "phone" in data:
        member.phone = normalize_phone(data["phone"]) if data["phone"] else None
    db.commit()
    db.refresh(member)
    return _to_out(member, db)


@router.post("/{user_id}/unlink-line", response_model=UserOut, dependencies=[Depends(require_edit)])
def unlink_line(user_id: int, db: Session = Depends(get_db)):
    """對應「會員詳情」LINE 綁定：解除後會員要重新在 LINE 裡加入或綁定。沒有密碼的會員解除後只能等管理員設定密碼。"""
    member = _member(db, user_id)
    clear_line_link(member)
    db.commit()
    db.refresh(member)
    return _to_out(member, db)


@router.put("/{user_id}/blacklist", response_model=UserOut, dependencies=[Depends(require_edit)])
def update_blacklist(user_id: int, payload: UserBlacklistUpdate, db: Session = Depends(get_db)):
    """對應「會員詳情」黑名單設定（開／關）。"""
    member = _member(db, user_id)
    member.is_blacklisted = payload.is_blacklisted
    db.commit()
    db.refresh(member)
    return _to_out(member, db)


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_edit)])
def reset_password(user_id: int, payload: UserResetPassword, db: Session = Depends(get_db)):
    """對應「會員詳情」登入密碼卡的「由管理員設定新密碼」。"""
    member = _member(db, user_id)
    member.password_hash = hash_password(payload.new_password)
    member.must_change_password = payload.must_change_password
    db.commit()
