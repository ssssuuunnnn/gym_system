from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    # 只用 LINE 加入、沒有設定密碼的會員（models.user.UNUSABLE_PASSWORD）
    if password_hash.startswith("!"):
        return False
    return pwd_context.verify(plain_password, password_hash)


def unusable_password() -> str:
    """沒有密碼的帳號：'!' 加上隨機值（不會被任何密碼驗證通過）。"""
    import secrets

    return "!" + secrets.token_urlsafe(24)


def create_access_token(*, user_id: int, tenant_id: int, role: str, is_coach: bool) -> str:
    """
    JWT payload 含 user_id、tid（租戶，必須與請求網址的租戶一致）、role（admin／member）、
    is_coach（是否綁定教練資料）。
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "tid": tenant_id,
        "role": role,
        "is_coach": is_coach,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


PLATFORM_SCOPE = "platform"


def create_platform_token(*, admin_id: int) -> str:
    """平台管理員的 JWT：scope=platform、沒有 tid，所以不能拿去打任何健身房的 API（反之亦然）。"""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.PLATFORM_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(admin_id), "scope": PLATFORM_SCOPE, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


SITE_PREVIEW_SCOPE = "site_preview"
SITE_PREVIEW_EXPIRE_MINUTES = 30


def create_site_preview_token(*, tenant_id: int) -> str:
    """
    形象網站草稿預覽用的短效 token（放在 iframe 網址上，所以不能用登入 token）：
    只能看該家的草稿，不能呼叫任何 API（get_current_user 拒絕帶 scope 的 token）。
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=SITE_PREVIEW_EXPIRE_MINUTES)
    payload = {"tid": tenant_id, "scope": SITE_PREVIEW_SCOPE, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


LINE_LINK_SCOPE = "line_link"
LINE_LINK_EXPIRE_MINUTES = 15


def create_line_link_token(*, tenant_id: int, line_user_id: str, line_name: str | None) -> str:
    """
    在 LINE 裡登入、但還沒綁定會員時發的短效 token（見 ADR 0005）：只能拿來「加入會員」或「綁定既有帳號」，
    帶 scope 所以不能呼叫其他 API。LINE 使用者 ID 只存在 token 裡，不會由前端自行指定。
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=LINE_LINK_EXPIRE_MINUTES)
    payload = {"tid": tenant_id, "scope": LINE_LINK_SCOPE, "lid": line_user_id, "lname": line_name, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
