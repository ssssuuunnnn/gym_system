"""
在健身房的 LINE 官方帳號裡登入、加入會員或綁定既有帳號（見 docs/adr/0005-gym-line-oa.md）。

1. LIFF 前端取得 ID token → POST /auth/line：向 LINE 驗證（aud＝這家健身房的登入 channel）
   - 已綁定 → 一般的登入 token
   - 未綁定 → 15 分鐘的 link_token（帶 scope，不能呼叫其他 API）
2. POST /auth/line/join（姓名、手機、同意個資告知）或 /auth/line/link（既有帳號＋密碼）→ 登入 token
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import (
    LINE_LINK_SCOPE,
    create_line_link_token,
    decode_access_token,
    unusable_password,
    verify_password,
)
from app.core.tenant_context import TenantInfo
from app.deps import get_current_user, get_db, get_tenant
from app.models.user import User, UserRole
from app.schemas.line_oa import LineAuthIn, LineAuthOut, LineJoinIn, LineLinkIn, LinePreferences
from app.schemas.user import Token, UserOut, user_out
from app.services import coupons as coupon_service
from app.services import line_oa as oa
from app.services.line import LineApiError
from app.services.members import clear_line_link, issue_token, new_line_username, normalize_phone, set_line_link
from app.deps import get_coach_profile

router = APIRouter(prefix="/auth/line", tags=["auth"])


def _enabled_channel(db: Session):
    channel = oa.get_enabled_channel(db)
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="這家店尚未啟用 LINE 會員")
    return channel


def _read_link_token(token: str, tenant: TenantInfo) -> tuple[str, str | None]:
    payload = decode_access_token(token)
    if not payload or payload.get("scope") != LINE_LINK_SCOPE or payload.get("tid") != tenant.id or not payload.get("lid"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="LINE 登入已逾時，請重新開啟")
    return payload["lid"], payload.get("lname")


@router.post("", response_model=LineAuthOut)
def line_login(payload: LineAuthIn, tenant: TenantInfo = Depends(get_tenant), db: Session = Depends(get_db)):
    channel = _enabled_channel(db)
    try:
        profile = oa.verify_id_token(payload.id_token, channel.login_channel_id)
    except LineApiError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="LINE 登入驗證失敗，請重新開啟")
    line_user_id = profile.get("sub")
    if not line_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="LINE 登入驗證失敗，請重新開啟")
    line_name = profile.get("name")

    user = db.query(User).filter(User.line_user_id == line_user_id).first()
    if user is None:
        return LineAuthOut(
            status="unlinked",
            link_token=create_line_link_token(tenant_id=tenant.id, line_user_id=line_user_id, line_name=line_name),
            line_display_name=line_name,
        )
    if line_name:
        user.line_display_name = line_name
    token = issue_token(user, db)
    db.commit()
    return LineAuthOut(status="ok", token=token, line_display_name=line_name)


@router.post("/join", response_model=Token, status_code=status.HTTP_201_CREATED)
def line_join(payload: LineJoinIn, tenant: TenantInfo = Depends(get_tenant), db: Session = Depends(get_db)):
    """加入會員：不需要帳號密碼，帳號自動產生；之後要用網頁登入請櫃台設定密碼。"""
    _enabled_channel(db)
    line_user_id, line_name = _read_link_token(payload.link_token, tenant)
    if not payload.consent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="請先閱讀並同意個人資料告知事項")
    name = payload.display_name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="請填寫姓名")
    if db.query(User.id).filter(User.line_user_id == line_user_id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="這個 LINE 帳號已經是會員，請重新開啟")

    user = User(
        username=new_line_username(db),
        password_hash=unusable_password(),
        role=UserRole.member,
        display_name=name,
        phone=normalize_phone(payload.phone),
    )
    set_line_link(user, line_user_id, line_name)
    if payload.marketing_consent:
        user.marketing_consent_at = datetime.utcnow()
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="這個 LINE 帳號已經是會員，請重新開啟")
    # LINE 新加入會員：自動發「LINE 新加入」體驗券（ADR 0010）
    coupon_service.auto_issue_on_line_join(db, user)
    token = issue_token(user, db)
    db.commit()
    return token


@router.post("/link", response_model=Token)
def line_link(payload: LineLinkIn, tenant: TenantInfo = Depends(get_tenant), db: Session = Depends(get_db)):
    """綁定既有會員帳號：必須輸入正確的帳號密碼。"""
    _enabled_channel(db)
    line_user_id, line_name = _read_link_token(payload.link_token, tenant)
    user = db.query(User).filter(User.username == payload.username.strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="帳號或密碼錯誤")
    if user.role == UserRole.admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="管理員帳號不能綁定 LINE，請用會員帳號")
    if user.is_blacklisted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="帳號已被列入黑名單")
    if user.line_user_id and user.line_user_id != line_user_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="這個帳號已綁定其他 LINE，請先請櫃台解除綁定")
    other = db.query(User).filter(User.line_user_id == line_user_id, User.id != user.id).first()
    if other:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="這個 LINE 已綁定其他會員帳號")

    set_line_link(user, line_user_id, line_name)
    token = issue_token(user, db)
    db.commit()
    return token


@router.post("/unlink", response_model=UserOut)
def line_unlink(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """會員自己解除 LINE 綁定。沒有密碼的會員解除後就無法登入，所以不允許。"""
    if not current_user.line_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="尚未綁定 LINE")
    if not current_user.has_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="你還沒有設定密碼，解除後將無法登入；請先請櫃台設定密碼"
        )
    clear_line_link(current_user)
    db.commit()
    db.refresh(current_user)
    return user_out(current_user, get_coach_profile(current_user, db) is not None)


@router.patch("/preferences", response_model=UserOut)
def line_preferences(
    payload: LinePreferences, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    會員自己的 LINE 設定：服務通知（預約結果、上課提醒、收款）與優惠活動訊息（行銷，R31）分開開關。
    同意行銷時記下時間，取消就清空。
    """
    if payload.line_notify is not None:
        current_user.line_notify = payload.line_notify
    if payload.marketing_consent is not None and payload.marketing_consent != current_user.marketing_consent:
        current_user.marketing_consent_at = datetime.utcnow() if payload.marketing_consent else None
    db.commit()
    db.refresh(current_user)
    return user_out(current_user, get_coach_profile(current_user, db) is not None)
