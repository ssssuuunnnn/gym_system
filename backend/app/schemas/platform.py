"""平台管理後台的請求／回應格式（見 docs/adr/0002-platform-console.md）。"""

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.tenant import BusinessType, TenantStatus


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
    # 行業類型：決定前後台用詞與預設功能（ADR 0011）
    business_type: BusinessType = BusinessType.fitness
    # 第一位管理員（健身房老闆／店長），交給對方登入後自行經營
    admin_username: str = Field(min_length=1, max_length=100)
    admin_password: str = Field(min_length=8)
    admin_must_change_password: bool = True


class TenantUpdate(TenantContact):
    """子網域不可修改：網址、登入狀態與上傳檔案路徑都跟著子網域。"""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    timezone: str | None = None
    business_type: BusinessType | None = None
    line_monthly_cap: int | None = Field(default=None, ge=0, le=100000)


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
    business_type: BusinessType
    contact_name: str | None
    contact_email: str | None
    contact_phone: str | None
    note: str | None
    line_monthly_cap: int
    created_at: datetime
    updated_at: datetime
    stats: TenantStats = TenantStats()
    # 試用（ADR 0013）：到期時間（UTC）、剩幾天、是否已到期；signup_source＝self 表示形象頁自助申請
    trial_ends_at: datetime | None = None
    trial_days_left: int | None = None
    trial_expired: bool = False
    signup_source: str | None = None


class TrialExtend(BaseModel):
    """延長試用：從今天或原到期日（較晚者）起再加幾天。"""

    days: int = Field(ge=1, le=365)


class PlatformSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    brand_name: str
    signup_enabled: bool
    contact_email: str | None
    show_email: bool
    contact_line: str | None
    show_line: bool
    contact_phone: str | None
    show_phone: bool
    updated_by: str | None
    updated_at: datetime


class PlatformSettingsUpdate(BaseModel):
    brand_name: str = Field(min_length=1, max_length=60)
    signup_enabled: bool
    contact_email: EmailStr | None = None
    show_email: bool = False
    contact_line: str | None = Field(default=None, max_length=200)
    show_line: bool = False
    contact_phone: str | None = Field(default=None, max_length=50)
    show_phone: bool = False

    _blank = field_validator("contact_email", "contact_line", "contact_phone", mode="before")(_blank_to_none)

    @field_validator("contact_line")
    @classmethod
    def _line(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value.startswith("http"):
            if not (value.startswith("https://lin.ee/") or value.startswith("https://line.me/")):
                raise ValueError("LINE 請填 @ID，或貼 https://lin.ee／https://line.me 開頭的加好友網址")
            return value
        if not re.match(r"^@?[A-Za-z0-9._-]{1,40}$", value):
            raise ValueError("LINE ID 格式不正確")
        return value if value.startswith("@") else f"@{value}"


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


# ---------- LINE 通知（docs/adr/0004-line-notifications.md） ----------


class LineGymUsage(BaseModel):
    tenant_id: int
    name: str
    subdomain: str
    recipients: int
    sent: int
    cap: int
    failed: int
    skipped: int
    retrying: int


class LineUsageSummary(BaseModel):
    configured: bool
    bot_name: str
    plan_quota: int
    month: str
    sent: int
    failed: int
    skipped: int
    recipients: int
    gyms_with_recipients: int
    gyms: list[LineGymUsage]


class LineLogOut(BaseModel):
    id: int
    tenant_id: int
    tenant_name: str | None
    event: str
    status: str
    recipient_count: int
    sent_count: int
    attempts: int
    note: str | None
    created_at: datetime
    updated_at: datetime
