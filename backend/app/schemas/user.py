from datetime import datetime

from pydantic import BaseModel, ConfigDict

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


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: UserRole
    created_at: datetime
    last_login_at: datetime | None
    is_blacklisted: bool
    is_coach: bool = False


class UserBlacklistUpdate(BaseModel):
    """對應「會員詳情」黑名單設定（開／關）。"""

    is_blacklisted: bool


class UserResetPassword(BaseModel):
    """對應「會員詳情」重設密碼按鈕。"""

    new_password: str
