from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


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
