from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import get_db
from app.deps import require_admin
from app.models.coach import Coach
from app.models.user import User, UserRole
from app.schemas.user import UserBlacklistUpdate, UserOut, UserResetPassword

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[UserOut])
def list_members(db: Session = Depends(get_db)):
    """
    對應「會員列表」：帳號、姓名、身份（學員／場租教練）、加入時間、最後操作時間、黑名單狀態。
    身份為衍生值：coaches 是否存在該 user_id 綁定紀錄。
    """
    members = db.query(User).filter(User.role == UserRole.member).all()
    coach_user_ids = {c.user_id for c in db.query(Coach.user_id).all()}
    return [UserOut(**m.__dict__, is_coach=m.id in coach_user_ids) for m in members]


@router.get("/{user_id}", response_model=UserOut)
def get_member(user_id: int, db: Session = Depends(get_db)):
    """對應「會員詳情」。"""
    member = db.get(User, user_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到會員")
    coach = db.query(Coach).filter(Coach.user_id == user_id).first()
    return UserOut(**member.__dict__, is_coach=coach is not None)


@router.put("/{user_id}/blacklist", response_model=UserOut)
def update_blacklist(user_id: int, payload: UserBlacklistUpdate, db: Session = Depends(get_db)):
    """對應「會員詳情」黑名單設定（開／關）。"""
    member = db.get(User, user_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到會員")
    member.is_blacklisted = payload.is_blacklisted
    db.commit()
    db.refresh(member)
    coach = db.query(Coach).filter(Coach.user_id == user_id).first()
    return UserOut(**member.__dict__, is_coach=coach is not None)


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(user_id: int, payload: UserResetPassword, db: Session = Depends(get_db)):
    """對應「會員詳情」重設密碼按鈕。"""
    member = db.get(User, user_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到會員")
    member.password_hash = hash_password(payload.new_password)
    db.commit()
