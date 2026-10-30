import time
from collections.abc import Generator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import PLATFORM_SCOPE, decode_access_token
from app.core.tenant_context import TenantInfo, current_tenant
from app.db import session as db_session
from app.db.session import TENANT_INFO_KEY
from app.models.coach import Coach
from app.models.platform import PlatformAdmin
from app.models.tenant import Tenant, TenantStatus
from app.models.user import User, UserRole
from app.services.tenants import SUBDOMAIN_RE

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# 子網域 → 租戶的短暫快取，避免每個請求都查 tenants（停用狀態最多延遲 TTL 秒生效）。
# 「查無此家」只快取很短的時間：剛開通的健身房不會因為先前有人打過網址而一直顯示找不到。
_TENANT_CACHE_TTL = 30.0
_TENANT_MISS_TTL = 5.0
_tenant_cache: dict[str, tuple[float, TenantInfo | None, TenantStatus | None]] = {}


def clear_tenant_cache() -> None:
    _tenant_cache.clear()


def subdomain_from_host(host: str) -> str | None:
    """`pulsefit.example.com:443` → `pulsefit`；不屬於 BASE_DOMAIN 的網址回 None。"""
    hostname = host.split(":")[0].strip().lower().rstrip(".")
    base = settings.BASE_DOMAIN.lower().strip(".")
    if base and hostname.endswith("." + base):
        sub = hostname[: -(len(base) + 1)]
        return sub if SUBDOMAIN_RE.match(sub) else None
    return None


def _lookup_tenant(subdomain: str) -> tuple[TenantInfo | None, TenantStatus | None]:
    now = time.monotonic()
    cached = _tenant_cache.get(subdomain)
    if cached and now - cached[0] < (_TENANT_CACHE_TTL if cached[1] is not None else _TENANT_MISS_TTL):
        return cached[1], cached[2]
    with db_session.SessionLocal() as s:
        tenant = s.query(Tenant).filter(Tenant.subdomain == subdomain).first()
        result = (
            (TenantInfo(id=tenant.id, subdomain=tenant.subdomain, timezone=tenant.timezone, business_type=tenant.business_type.name), tenant.status)
            if tenant
            else (None, None)
        )
    _tenant_cache[subdomain] = (now, *result)
    return result


async def get_tenant(request: Request) -> TenantInfo:
    """
    依 Host 的子網域判斷目前租戶（見 ADR 0001）。本機開發沒有子網域時用 DEFAULT_TENANT。
    async：設定的 contextvar 才會留在請求的 context，後續（含同步端點）讀得到。
    """
    subdomain = subdomain_from_host(request.headers.get("host", "")) or settings.DEFAULT_TENANT or None
    info, tenant_status = _lookup_tenant(subdomain) if subdomain else (None, None)
    if info is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到這家健身房")
    if tenant_status == TenantStatus.suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="此健身房目前停用中")
    current_tenant.set(info)
    return info


def get_db(tenant: TenantInfo = Depends(get_tenant)) -> Generator[Session, None, None]:
    """綁定目前租戶的 Session：每個交易開始時把租戶設給資料庫（RLS 依此過濾）。"""
    db = db_session.SessionLocal()
    db.info[TENANT_INFO_KEY] = tenant.id
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    tenant: TenantInfo = Depends(get_tenant),  # 先判斷租戶：未知網址回 404 而非 401
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="無法驗證登入狀態",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_error

    user_id = payload.get("sub")
    # token 必須屬於目前網址的租戶：拿 A 家的 token 打 B 家的網址一律拒絕；平台管理員的 token 沒有 tid，也會被拒絕
    if user_id is None or payload.get("scope") is not None or payload.get("tid") != tenant.id:
        raise credentials_error

    user = db.get(User, int(user_id))
    if user is None:
        raise credentials_error
    if user.is_blacklisted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="帳號已被列入黑名單")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="帳號已停用")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """僅 admin（該健身房的管理員）可用的路由依賴。"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="僅管理員可執行此操作")
    return current_user


def require_perm(*codes: str):
    """
    後台功能權限（ADR 0008）：有其中任何一項功能才可呼叫。主要管理者、管理者擁有全部功能。
    也可直接呼叫 require_perm("x")(current_user) 在函式內檢查。
    """
    from app.services.staff import has_perm, label

    def dependency(current_user: User = Depends(require_admin)) -> User:
        if not has_perm(current_user, *codes):
            names = "、".join(label(c) for c in codes)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"沒有「{names}」的權限")
        return current_user

    return dependency


def require_owner(current_user: User = Depends(require_admin), db: Session = Depends(get_db)) -> User:
    """只有主要管理者可以管理後台帳號與權限（R37）。這家沒有主要管理者時，最早建立的管理員自動成為主要管理者。"""
    from app.models.user import StaffLevel
    from app.services.staff import ensure_owner

    if current_user.staff_level != StaffLevel.owner:
        owner = ensure_owner(db)
        db.commit()
        if owner is None or owner.id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有主要管理者可以管理後台帳號")
    return current_user


def get_coach_profile(current_user: User, db: Session) -> Coach | None:
    """依 user_id 查詢是否存在教練資料綁定紀錄，用於衍生「身份（學員／教練）」。"""
    return db.query(Coach).filter(Coach.user_id == current_user.id).first()


def require_coach(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Coach:
    """僅教練身份會員可用的路由依賴。"""
    coach = get_coach_profile(current_user, db)
    if coach is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="僅教練身份會員可執行此操作")
    return coach


# ---------- 平台管理後台（見 docs/adr/0002-platform-console.md） ----------

platform_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/platform/auth/login")


def require_platform_host(request: Request) -> None:
    """平台 API 只在 <PLATFORM_SUBDOMAIN>.<BASE_DOMAIN> 提供；在健身房網址上一律 404。"""
    if subdomain_from_host(request.headers.get("host", "")) != settings.PLATFORM_SUBDOMAIN:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")


def get_platform_db() -> Generator[Session, None, None]:
    """平台帳號的 Session：不屬於任何租戶；要操作某家的帳號時用 act_as_tenant() 切換。"""
    db = db_session.PlatformSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_platform_admin(
    token: str = Depends(platform_oauth2_scheme),
    db: Session = Depends(get_platform_db),
) -> PlatformAdmin:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="無法驗證登入狀態",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None or payload.get("scope") != PLATFORM_SCOPE or payload.get("sub") is None:
        raise credentials_error
    admin = db.get(PlatformAdmin, int(payload["sub"]))
    if admin is None or not admin.is_active:
        raise credentials_error
    return admin
