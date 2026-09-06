from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SystemSettingsBase(BaseModel):
    company_name: str
    short_name: str | None = None
    logo_url: str | None = None


class SystemSettingsUpdate(BaseModel):
    company_name: str | None = None
    short_name: str | None = None
    logo_url: str | None = None


class SystemSettingsOut(SystemSettingsBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: datetime


class SystemSettingsLogoOut(BaseModel):
    """對應「系統設定」LOGO 上傳：回傳可存入 logo_url 的相對網址。"""

    url: str
