"""
開通與管理店家（租戶）的共用邏輯：平台管理後台（routers/platform.py）與 CLI（app/cli.py）共用。
見 docs/adr/0001-multi-tenancy.md、docs/adr/0002-platform-console.md。

這裡的函式只 add / flush，由呼叫端決定何時 commit（開通店家＋第一位管理員是同一個交易）。

注意：CLI 以資料表擁有者連線，擁有者不受 RLS 限制，所以操作各家帳號的查詢除了 act_as_tenant()
之外，也明確加上 tenant_id 條件（一般路由不需要這樣做，RLS 會處理）。
"""

import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import act_as_tenant
from app.models.platform import PlatformAuditLog
from app.models.tenant import BusinessType, Tenant, TenantStatus
from app.models.user import User, UserRole

# 子網域格式：小寫英數與連字號，不可以連字號開頭或結尾，最多 63 字
SUBDOMAIN_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")

# 平台自己會用到的子網域，不開放給店家
RESERVED_SUBDOMAINS = {
    "www", "api", "app", "admin", "platform", "static", "media", "mail", "status", "help", "support", "docs",
}

MIN_PASSWORD_LENGTH = 8

# 平台操作紀錄的操作代碼 → 顯示名稱
AUDIT_ACTIONS = {
    "create_tenant": "開通店家",
    "update_tenant": "修改店家資料",
    "set_status": "變更狀態",
    "create_tenant_admin": "新增店家管理員",
    "reset_tenant_admin_password": "重設店家管理員密碼",
}


class TenantError(ValueError):
    """輸入不合法（子網域、時區、密碼…）；訊息可直接顯示給使用者。"""


def normalize_subdomain(subdomain: str) -> str:
    return subdomain.strip().lower()


def subdomain_problem(db: Session, subdomain: str) -> str | None:
    """子網域不能用的原因；可以用時回傳 None。"""
    sub = normalize_subdomain(subdomain)
    if not SUBDOMAIN_RE.match(sub):
        return "子網域只能用小寫英文、數字與連字號（不可以連字號開頭或結尾），最多 63 字"
    if sub in RESERVED_SUBDOMAINS or sub == settings.PLATFORM_SUBDOMAIN:
        return f"「{sub}」是平台保留的子網域"
    if db.query(Tenant.id).filter(Tenant.subdomain == sub).first():
        return f"「{sub}」已經有店家使用"
    return None


def validate_timezone(timezone: str) -> str:
    try:
        ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise TenantError(f"未知的時區：{timezone}") from exc
    return timezone


def validate_password(password: str) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise TenantError(f"密碼至少 {MIN_PASSWORD_LENGTH} 個字元")
    return password


def create_tenant(
    db: Session,
    *,
    subdomain: str,
    name: str,
    timezone: str = "Asia/Taipei",
    status: TenantStatus = TenantStatus.trial,
    business_type: BusinessType = BusinessType.fitness,
    contact_name: str | None = None,
    contact_email: str | None = None,
    contact_phone: str | None = None,
    note: str | None = None,
) -> Tenant:
    problem = subdomain_problem(db, subdomain)
    if problem:
        raise TenantError(problem)
    tenant = Tenant(
        subdomain=normalize_subdomain(subdomain),
        name=name.strip(),
        timezone=validate_timezone(timezone),
        status=status,
        business_type=business_type,
        contact_name=contact_name,
        contact_email=contact_email,
        contact_phone=contact_phone,
        note=note,
    )
    db.add(tenant)
    db.flush()
    return tenant


def tenant_admins(db: Session, tenant_id: int) -> list[User]:
    act_as_tenant(db, tenant_id)
    return (
        db.query(User)
        .filter(User.tenant_id == tenant_id, User.role == UserRole.admin)
        .order_by(User.id)
        .all()
    )


def create_tenant_admin(
    db: Session, tenant_id: int, username: str, password: str, *, must_change_password: bool = False
) -> User:
    """在指定健身房建立管理員帳號（同一交易內切換到該租戶，受 RLS 限制）。"""
    username = username.strip()
    if not username:
        raise TenantError("請輸入管理員帳號")
    validate_password(password)
    act_as_tenant(db, tenant_id)
    exists = (
        db.query(User.id)
        .filter(User.tenant_id == tenant_id, func.lower(User.username) == username.lower())
        .first()
    )
    if exists:
        raise TenantError(f"這家店已經有「{username}」這個帳號")
    from app.services.staff import initial_level  # 避免循環匯入

    user = User(
        username=username,
        password_hash=hash_password(password),
        role=UserRole.admin,
        # 這家的第一個管理員是主要管理者，之後平台加的是管理者（ADR 0008）
        staff_level=initial_level(db),
        must_change_password=must_change_password,
    )
    db.add(user)
    db.flush()
    return user


def reset_tenant_admin_password(
    db: Session, tenant_id: int, user_id: int, new_password: str, *, must_change_password: bool = True
) -> User:
    validate_password(new_password)
    act_as_tenant(db, tenant_id)
    user = db.get(User, user_id)
    if user is None or user.tenant_id != tenant_id or user.role != UserRole.admin:
        raise LookupError("找不到這位管理員")
    user.password_hash = hash_password(new_password)
    user.must_change_password = must_change_password
    db.flush()
    return user


def audit(
    db: Session,
    *,
    action: str,
    admin_id: int | None,
    admin_username: str,
    tenant_id: int | None,
    detail: dict | None = None,
) -> None:
    assert action in AUDIT_ACTIONS, action
    db.add(
        PlatformAuditLog(
            action=action, admin_id=admin_id, admin_username=admin_username, tenant_id=tenant_id, detail=detail
        )
    )
