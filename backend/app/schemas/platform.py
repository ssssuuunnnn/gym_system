"""平台管理後台的請求／回應格式（見 docs/adr/0002-platform-console.md）。"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.tenant import TenantStatus


def _blank_to_none(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


# ---------- 平台帳號 ----------


class PlatformLogin(BaseModel):
    username: str
    password: str


class PlatformToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class PlatformAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    last_login_at: datetime | None
    created_at: datetime


class PlatformChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


# ---------- 健身房 ----------


class TenantContact(BaseModel):
    contact_name: str | None = Field(default=None, max_length=100)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=50)
    note: str | None = Field(default=None, max_length=1000)

    _blank = field_validator("contact_name", "contact_email", "contact_phone", "note", mode="before")(
        _blank_to_none
    )


class TenantCreate(TenantContact):
    name: str = Field(min_length=1, max_length=100)
    subdomain: str = Field(min_length=1, max_length=63)
    timezone: str = "Asia/Taipei"
    status: TenantStatus = TenantStatus.trial
    # 第一位管理員（健身房老闆／店長），交給對方登入後自行經營
    admin_username: str = Field(min_length=1, max_length=100)
    admin_password: str = Field(min_length=8)
    admin_must_change_password: bool = True


class TenantUpdate(TenantContact):
    """子網域不可修改：網址、登入狀態與上傳檔案路徑都跟著子網域。"""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    timezone: str | None = None


class TenantStatusUpdate(BaseModel):
    status: TenantStatus
    reason: str | None = Field(default=None, max_length=500)


class TenantStats(BaseModel):
    member_count: int = 0
    admin_count: int = 0
    coach_count: int = 0
    reservations_this_month: int = 0
    last_login_at: datetime | None = None


class TenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    subdomain: str
    status: TenantStatus
    timezone: str
    contact_name: str | None
    contact_email: str | None
    contact_phone: str | None
    note: str | None
    created_at: datetime
    updated_at: datetime
    stats: TenantStats = TenantStats()


class SubdomainCheck(BaseModel):
    subdomain: str
    available: bool
    reason: str | None = None


# ---------- 健身房管理員帳號 ----------


class TenantAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    is_blacklisted: bool
    must_change_password: bool
    last_login_at: datetime | None
    created_at: datetime


class TenantAdminCreate(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8)
    must_change_password: bool = True


class TenantAdminResetPassword(BaseModel):
    new_password: str = Field(min_length=8)
    must_change_password: bool = True


# ---------- 操作紀錄 ----------


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    admin_username: str
    tenant_id: int | None
    tenant_name: str | None = None
    action: str
    action_label: str
    detail: dict | None
    created_at: datetime
