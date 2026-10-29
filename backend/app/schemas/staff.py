from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.user import StaffLevel

# 主要管理者只能透過「移交」產生，新增／修改時只能選這兩種
AssignableLevel = Literal["管理者", "一般使用者"]


class PermissionDef(BaseModel):
    code: str
    label: str
    sensitive: bool
    hint: str


class RoleTemplate(BaseModel):
    key: str
    label: str
    codes: list[str]


class StaffMeta(BaseModel):
    permissions: list[PermissionDef]
    templates: list[RoleTemplate]


class StaffOut(BaseModel):
    id: int
    username: str
    display_name: str | None
    level: StaffLevel
    # 一般使用者勾選的功能；主要管理者、管理者回傳全部功能
    permissions: list[str]
    is_active: bool
    must_change_password: bool
    last_login_at: datetime | None
    created_at: datetime


class StaffCreate(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    display_name: str | None = Field(default=None, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    level: AssignableLevel = "一般使用者"
    permissions: list[str] = Field(default_factory=list)


class StaffUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=50)
    level: AssignableLevel | None = None
    permissions: list[str] | None = None


class StaffStatus(BaseModel):
    is_active: bool


class StaffPassword(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class OwnerTransfer(BaseModel):
    user_id: int
    # 主要管理者自己的密碼（再確認一次）
    password: str


class StaffAuditOut(BaseModel):
    id: int
    actor_name: str
    target_name: str | None
    action: str
    detail: str
    created_at: datetime
