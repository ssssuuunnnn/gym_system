"""會員帳號的共用邏輯：登入回應、手機格式、LINE 綁定（見 ADR 0005）。"""

import re
import secrets
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.deps import get_coach_profile
from app.models.user import User
from app.schemas.user import Token

PHONE_PATTERN = re.compile(r"^\+?\d{8,15}$")


def normalize_phone(value: str) -> str:
    """去掉空白與連字號；只接受 8–15 位數字（可加 +）。"""
    phone = re.sub(r"[\s\-()]", "", value or "")
    if not PHONE_PATTERN.match(phone):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="手機號碼格式不正確")
    return phone


def issue_token(user: User, db: Session) -> Token:
    """登入成功：更新最後登入時間並發 JWT（呼叫端 commit）。"""
    if user.is_blacklisted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="帳號已被列入黑名單")
    is_coach = get_coach_profile(user, db) is not None
    user.last_login_at = datetime.utcnow()
    token = create_access_token(user_id=user.id, tenant_id=user.tenant_id, role=user.role.value, is_coach=is_coach)
    return Token(access_token=token, role=user.role, is_coach=is_coach, must_change_password=user.must_change_password)


def new_line_username(db: Session) -> str:
    """在 LINE 加入的會員自動產生帳號（line-xxxxxx），管理員之後可在會員詳情修改。"""
    while True:
        username = f"line-{secrets.token_hex(3)}"
        if not db.query(User.id).filter(User.username == username).first():
            return username


def set_line_link(user: User, line_user_id: str, line_display_name: str | None) -> None:
    user.line_user_id = line_user_id
    user.line_display_name = line_display_name
    user.line_linked_at = datetime.utcnow()


def clear_line_link(user: User) -> None:
    user.line_user_id = None
    user.line_display_name = None
    user.line_linked_at = None
