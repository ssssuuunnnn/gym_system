from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole


class UserRegister(BaseModel):
    """對應「會員註冊頁」：帳號、密碼、確認密碼。確認密碼比對在路由層處理，不進入 schema。"""

    username: str
    password: str


class UserLogin(BaseModel):
    """對應「登入頁」：帳號、密碼。"""

    username: str
    password: str


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


class UserUpdate(BaseModel):
    """對應「會員詳情」會員資料卡的帳號欄位。帳號須為系統內唯一值。"""

    username: str


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
