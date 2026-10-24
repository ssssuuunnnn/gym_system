from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SystemSettingsBase(BaseModel):
    company_name: str
    short_name: str | None = None
    logo_url: str | None = None
    cancel_deadline_hours: int = 12


class SystemSettingsUpdate(BaseModel):
    company_name: str | None = None
    short_name: str | None = None
    logo_url: str | None = None
    # 開課前幾小時內取消不退堂；0＝不限制，上限一週
    cancel_deadline_hours: int | None = Field(default=None, ge=0, le=168)


class SystemSettingsOut(SystemSettingsBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: datetime


class SystemSettingsLogoOut(BaseModel):
    """對應「系統設定」LOGO 上傳：回傳可存入 logo_url 的相對網址。"""

    url: str
