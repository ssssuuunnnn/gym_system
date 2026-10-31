from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import StaffLevel, UserRole


class UserRegister(BaseModel):
    """對應「會員註冊頁」：帳號、密碼、確認密碼。確認密碼比對在路由層處理，不進入 schema。"""

    username: str
    password: str


class UserLogin(BaseModel):
    """對應「登入頁」：帳號、密碼。"""

    username: str
    password: str


class StaffInfo(BaseModel):
    """後台帳號的身分與可用功能（ADR 0008）；會員帳號為 None。"""

    level: StaffLevel
    permissions: list[str]


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    is_coach: bool
    # 管理員曾在「會員詳情」重設密碼並要求會員自行修改時為 true，前端據此導向修改密碼頁
    must_change_password: bool = False


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: UserRole
    created_at: datetime
    last_login_at: datetime | None
    is_blacklisted: bool
    is_coach: bool = False
    # 會員資料與 LINE 綁定（見 ADR 0005）
    display_name: str | None = None
    phone: str | None = None
    has_password: bool = True
    line_linked: bool = False
    line_display_name: str | None = None
    line_linked_at: datetime | None = None
    line_notify: bool = True
    is_active: bool = True
    # 後台帳號的身分與可用功能（ADR 0008）
    staff: StaffInfo | None = None
    # 同意接收優惠與活動訊息（R31）
    marketing_consent: bool = False
    marketing_consent_at: datetime | None = None
    # 會員標籤（ADR 0012）：只在後台的會員 API 填入，不給會員自己看
    tag_ids: list[int] = []


def user_out(user, is_coach: bool) -> UserOut:
    from app.services.staff import effective_permissions, level_of

    level = level_of(user)
    staff = StaffInfo(level=level, permissions=effective_permissions(user)) if level else None
    return UserOut.model_validate(user).model_copy(update={"is_coach": is_coach, "staff": staff})


class UserUpdate(BaseModel):
    """對應「會員詳情」會員資料卡：帳號（系統內唯一）、姓名、手機。"""

    username: str | None = None
    display_name: str | None = Field(default=None, max_length=50)
    phone: str | None = Field(default=None, max_length=30)


class UserBlacklistUpdate(BaseModel):
    """對應「會員詳情」黑名單設定（開／關）。"""

    is_blacklisted: bool


class UserResetPassword(BaseModel):
    """對應「會員詳情」登入密碼卡的「由管理員設定新密碼」。"""

    new_password: str = Field(min_length=8)
    must_change_password: bool = False


class ChangePassword(BaseModel):
    """對應「會員修改密碼頁」：驗證目前密碼後設定新密碼，並解除強制修改狀態。"""

    current_password: str
    new_password: str = Field(min_length=8)
