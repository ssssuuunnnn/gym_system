"""
平台管理後台 API（見 docs/adr/0002-platform-console.md）。

- 只在平台網址 <PLATFORM_SUBDOMAIN>.<BASE_DOMAIN> 提供，健身房網址打這些路徑一律 404。
- 以平台帳號（PLATFORM_DB_ROLE）連線：可管理健身房清單、平台帳號與操作紀錄；
  各家的帳號受 RLS 限制，必須先切換到該家（act_as_tenant）才看得到；
  跨租戶只能取得彙總數字（platform_tenant_stats()），看不到會員、預約等明細。
- 每個會改變狀態的操作都寫一筆 platform_audit_logs。
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_platform_token, hash_password, verify_password
from app.deps import clear_tenant_cache, get_current_platform_admin, get_platform_db, require_platform_host
from app.models.platform import PlatformAdmin, PlatformAuditLog
from app.models.tenant import Tenant, TenantStatus
from app.schemas.platform import (
    AuditLogOut,
    LineGymUsage,
    LineLogOut,
    LineUsageSummary,
    PlatformAdminOut,
    PlatformChangePassword,
    PlatformLogin,
    PlatformToken,
    SubdomainCheck,
    TenantAdminCreate,
    TenantAdminOut,
    TenantAdminResetPassword,
    TenantCreate,
    TenantOut,
    TenantStats,
    TenantStatusUpdate,
    TenantUpdate,
)
from app.models.line import LineEvent, LineNotificationStatus
from app.services import line as line_service
from app.services import tenants as tenant_service
from app.services.tenants import AUDIT_ACTIONS, TenantError

router = APIRouter(prefix="/platform", tags=["platform"], dependencies=[Depends(require_platform_host)])

# 平台管理員不存在時也跑一次雜湊比對，避免從回應時間猜出帳號是否存在
_DUMMY_HASH = hash_password("platform-dummy-password")


def _bad_request(exc: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _month_start() -> datetime:
    now = datetime.now(ZoneInfo(settings.STUDIO_TIMEZONE))
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _stats_by_tenant(db: Session) -> dict[int, TenantStats]:
    rows = db.execute(
        text("SELECT * FROM platform_tenant_stats(:month_start)"), {"month_start": _month_start().date()}
    ).mappings()
    return {
        row["tenant_id"]: TenantStats(**{k: v for k, v in row.items() if k != "tenant_id"}) for row in rows
    }


def _tenant_out(tenant: Tenant, stats: dict[int, TenantStats]) -> TenantOut:
    out = TenantOut.model_validate(tenant)
    out.stats = stats.get(tenant.id, TenantStats())
    return out


def _get_tenant(db: Session, tenant_id: int) -> Tenant:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到這家店")
    return tenant


def _audit(db: Session, admin: PlatformAdmin, action: str, tenant_id: int | None, detail: dict | None = None):
    tenant_service.audit(
        db, action=action, admin_id=admin.id, admin_username=admin.username, tenant_id=tenant_id, detail=detail
    )


# ---------- 平台帳號 ----------


@router.post("/auth/login", response_model=PlatformToken)
def login(payload: PlatformLogin, db: Session = Depends(get_platform_db)):
    admin = db.query(PlatformAdmin).filter(PlatformAdmin.username == payload.username).first()
    password_ok = verify_password(payload.password, admin.password_hash if admin else _DUMMY_HASH)
    if admin is None or not password_ok or not admin.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="帳號或密碼錯誤")
    admin.last_login_at = datetime.utcnow()
    db.commit()
    return PlatformToken(access_token=create_platform_token(admin_id=admin.id), username=admin.username)


@router.get("/auth/me", response_model=PlatformAdminOut)
def me(admin: PlatformAdmin = Depends(get_current_platform_admin)):
    return admin


@router.post("/auth/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: PlatformChangePassword,
    admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_platform_db),
):
    if not verify_password(payload.current_password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="目前密碼不正確")
    admin.password_hash = hash_password(payload.new_password)
    db.commit()


# ---------- 健身房 ----------


@router.get("/tenants", response_model=list[TenantOut])
def list_tenants(
    status_filter: TenantStatus | None = Query(default=None, alias="status"),
    q: str | None = None,
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_platform_db),
):
    query = db.query(Tenant)
    if status_filter is not None:
        query = query.filter(Tenant.status == status_filter)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(Tenant.name.ilike(like), Tenant.subdomain.ilike(like)))
    stats = _stats_by_tenant(db)
    return [_tenant_out(t, stats) for t in query.order_by(Tenant.created_at.desc(), Tenant.id.desc())]


@router.get("/tenants/check-subdomain", response_model=SubdomainCheck)
def check_subdomain(
    subdomain: str,
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_platform_db),
):
    sub = tenant_service.normalize_subdomain(subdomain)
    problem = tenant_service.subdomain_problem(db, sub)
    return SubdomainCheck(subdomain=sub, available=problem is None, reason=problem)


@router.post("/tenants", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(
    payload: TenantCreate,
    admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_platform_db),
):
    """開通健身房＋第一位管理員，同一個交易：任何一步失敗都不會留下半套資料。"""
    try:
        tenant = tenant_service.create_tenant(
            db,
            subdomain=payload.subdomain,
            name=payload.name,
            timezone=payload.timezone,
            status=payload.status,
            business_type=payload.business_type,
            contact_name=payload.contact_name,
            contact_email=payload.contact_email,
            contact_phone=payload.contact_phone,
            note=payload.note,
        )
        tenant_admin = tenant_service.create_tenant_admin(
            db,
            tenant.id,
            payload.admin_username,
            payload.admin_password,
            must_change_password=payload.admin_must_change_password,
        )
    except TenantError as exc:
        db.rollback()
        raise _bad_request(exc) from exc
    _audit(
        db,
        admin,
        "create_tenant",
        tenant.id,
        {
            "subdomain": tenant.subdomain,
            "name": tenant.name,
            "timezone": tenant.timezone,
            "status": tenant.status.value,
            "business_type": tenant.business_type.value,
            "admin_username": tenant_admin.username,
        },
    )
    try:
        db.commit()
    except IntegrityError as exc:  # 兩個人同時用同一個子網域開通
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="子網域剛剛被使用了，請換一個") from exc
    clear_tenant_cache()  # 開通前若有人打過這個網址，「查無此家」可能還在快取裡
    db.refresh(tenant)
    return _tenant_out(tenant, _stats_by_tenant(db))


@router.get("/tenants/{tenant_id}", response_model=TenantOut)
def get_tenant(
    tenant_id: int,
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_platform_db),
):
    return _tenant_out(_get_tenant(db, tenant_id), _stats_by_tenant(db))


@router.put("/tenants/{tenant_id}", response_model=TenantOut)
def update_tenant(
    tenant_id: int,
    payload: TenantUpdate,
    admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_platform_db),
):
    tenant = _get_tenant(db, tenant_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("name") is not None:
        data["name"] = data["name"].strip()
    elif "name" in data:
        data.pop("name")  # 名稱不可清空
    if "business_type" in data and data["business_type"] is None:
        data.pop("business_type")
    if "timezone" in data:
        if data["timezone"] is None:
            data.pop("timezone")
        else:
            try:
                tenant_service.validate_timezone(data["timezone"])
            except TenantError as exc:
                raise _bad_request(exc) from exc

    changes = {}
    for field, value in data.items():
        old = getattr(tenant, field)
        if old != value:
            changes[field] = [old, value]
            setattr(tenant, field, value)
    if changes:
        _audit(db, admin, "update_tenant", tenant.id, changes)
        db.commit()
        if "timezone" in changes or "business_type" in changes:
            clear_tenant_cache()
        db.refresh(tenant)
    return _tenant_out(tenant, _stats_by_tenant(db))


@router.post("/tenants/{tenant_id}/status", response_model=TenantOut)
def set_tenant_status(
    tenant_id: int,
    payload: TenantStatusUpdate,
    admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_platform_db),
):
    """停用後，該家所有網址回 403（含已登入的人）；資料保留，重新啟用即恢復。"""
    tenant = _get_tenant(db, tenant_id)
    if tenant.status != payload.status:
        _audit(
            db,
            admin,
            "set_status",
            tenant.id,
            {"from": tenant.status.value, "to": payload.status.value, "reason": payload.reason},
        )
        tenant.status = payload.status
        db.commit()
        clear_tenant_cache()
        db.refresh(tenant)
    return _tenant_out(tenant, _stats_by_tenant(db))


# ---------- 健身房的管理員帳號 ----------


@router.get("/tenants/{tenant_id}/admins", response_model=list[TenantAdminOut])
def list_tenant_admins(
    tenant_id: int,
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_platform_db),
):
    _get_tenant(db, tenant_id)
    return tenant_service.tenant_admins(db, tenant_id)


@router.post("/tenants/{tenant_id}/admins", response_model=TenantAdminOut, status_code=status.HTTP_201_CREATED)
def create_tenant_admin(
    tenant_id: int,
    payload: TenantAdminCreate,
    admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_platform_db),
):
    _get_tenant(db, tenant_id)
    try:
        user = tenant_service.create_tenant_admin(
            db, tenant_id, payload.username, payload.password, must_change_password=payload.must_change_password
        )
    except TenantError as exc:
        db.rollback()
        raise _bad_request(exc) from exc
    _audit(db, admin, "create_tenant_admin", tenant_id, {"username": user.username})
    db.commit()
    db.refresh(user)
    return user


@router.post("/tenants/{tenant_id}/admins/{user_id}/reset-password", response_model=TenantAdminOut)
def reset_tenant_admin_password(
    tenant_id: int,
    user_id: int,
    payload: TenantAdminResetPassword,
    admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_platform_db),
):
    """健身房管理員忘記密碼時由平台協助重設；只能重設管理員，不能動會員帳號。"""
    _get_tenant(db, tenant_id)
    try:
        user = tenant_service.reset_tenant_admin_password(
            db, tenant_id, user_id, payload.new_password, must_change_password=payload.must_change_password
        )
    except TenantError as exc:
        db.rollback()
        raise _bad_request(exc) from exc
    except LookupError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _audit(
        db,
        admin,
        "reset_tenant_admin_password",
        tenant_id,
        {"username": user.username, "must_change_password": payload.must_change_password},
    )
    db.commit()
    db.refresh(user)
    return user


# ---------- 操作紀錄 ----------


@router.get("/audit-logs", response_model=list[AuditLogOut])
def list_audit_logs(
    tenant_id: int | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_platform_db),
):
    query = db.query(PlatformAuditLog)
    if tenant_id is not None:
        query = query.filter(PlatformAuditLog.tenant_id == tenant_id)
    logs = query.order_by(PlatformAuditLog.created_at.desc(), PlatformAuditLog.id.desc()).limit(limit).all()
    names = dict(db.query(Tenant.id, Tenant.name).all())
    return [
        AuditLogOut(
            id=log.id,
            admin_username=log.admin_username,
            tenant_id=log.tenant_id,
            tenant_name=names.get(log.tenant_id),
            action=log.action,
            action_label=AUDIT_ACTIONS.get(log.action, log.action),
            detail=log.detail,
            created_at=log.created_at,
        )
        for log in logs
    ]


# ---------- LINE 通知（docs/adr/0004-line-notifications.md） ----------


def _month_start_utc(month: str | None) -> tuple[str, datetime]:
    """YYYY-MM（台北時間的月初）→ 對應的 UTC 時間；未指定時為本月。"""
    tz = ZoneInfo(settings.STUDIO_TIMEZONE)
    if month:
        try:
            local = datetime.strptime(month, "%Y-%m")
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="月份格式為 YYYY-MM") from exc
    else:
        local = _month_start().replace(tzinfo=None)
    start = local.replace(tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
    return local.strftime("%Y-%m"), start


@router.get("/line/summary", response_model=LineUsageSummary)
def line_summary(
    month: str | None = None,
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_platform_db),
):
    """全平台與各健身房的 LINE 通知用量（只有彙總數字）。"""
    label, start = _month_start_utc(month)
    usage = {
        row["tenant_id"]: row
        for row in db.execute(text("SELECT * FROM platform_line_usage(:s)"), {"s": start}).mappings()
    }
    gyms = []
    for tenant in db.query(Tenant).order_by(Tenant.name):
        u = usage.get(tenant.id) or {}
        gyms.append(
            LineGymUsage(
                tenant_id=tenant.id,
                name=tenant.name,
                subdomain=tenant.subdomain,
                recipients=u.get("recipients", 0),
                sent=u.get("sent", 0),
                cap=tenant.line_monthly_cap,
                failed=u.get("failed", 0),
                skipped=u.get("skipped", 0),
                retrying=u.get("retrying", 0),
            )
        )
    gyms.sort(key=lambda g: (-g.sent, g.name))
    return LineUsageSummary(
        configured=line_service.is_configured(),
        bot_name=settings.LINE_BOT_NAME,
        plan_quota=settings.LINE_PLAN_MONTHLY_QUOTA,
        month=label,
        sent=sum(g.sent for g in gyms),
        failed=sum(g.failed for g in gyms),
        skipped=sum(g.skipped for g in gyms),
        recipients=sum(g.recipients for g in gyms),
        gyms_with_recipients=sum(1 for g in gyms if g.recipients),
        gyms=gyms,
    )


@router.get("/line/logs", response_model=list[LineLogOut])
def line_logs(
    status_filter: LineNotificationStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    _: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_platform_db),
):
    """發送紀錄：只有事件、則數、結果與說明，不含發送對象與訊息內容。"""
    rows = db.execute(
        text("SELECT * FROM platform_line_log(:limit, :status)"),
        {"limit": limit, "status": status_filter.name if status_filter else None},
    ).mappings()
    names = dict(db.query(Tenant.id, Tenant.name).all())
    return [
        LineLogOut(
            **{k: v for k, v in row.items() if k not in ("event", "status")},
            tenant_name=names.get(row["tenant_id"]),
            event=LineEvent[row["event"]].value,
            status=LineNotificationStatus[row["status"]].value,
        )
        for row in rows
    ]
