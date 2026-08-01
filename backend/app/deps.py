from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.coach import Coach
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="無法驗證登入狀態",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_error

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_error

    user = db.get(User, int(user_id))
    if user is None:
        raise credentials_error
    if user.is_blacklisted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="帳號已被列入黑名單")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """僅 admin 可用的路由依賴，對應時段開放設定、會員黑名單等管理端限定功能。"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="僅管理員可執行此操作")
    return current_user


def get_coach_profile(current_user: User, db: Session) -> Coach | None:
    """依 user_id 查詢是否存在教練資料綁定紀錄，用於衍生「身份（學員／場租教練）」。"""
    return db.query(Coach).filter(Coach.user_id == current_user.id).first()


def require_coach(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Coach:
    """僅場租教練身份會員可用的路由依賴，對應加購臨時加人 (3b) 等限定功能。"""
    coach = get_coach_profile(current_user, db)
    if coach is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="僅教練身份會員可執行此操作")
    return coach
