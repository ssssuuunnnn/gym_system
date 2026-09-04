from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CoachBase(BaseModel):
    name: str
    alias: str | None = None
    line_name: str | None = None
    phone: str
    bank_code: str | None = None
    bank_account: str | None = None
    specialty: str | None = None
    photo_url: str | None = None


class CoachCreate(CoachBase):
    user_id: int


class CoachUpdate(BaseModel):
    name: str | None = None
    alias: str | None = None
    line_name: str | None = None
    phone: str | None = None
    bank_code: str | None = None
    bank_account: str | None = None
    specialty: str | None = None
    photo_url: str | None = None


class CoachOut(CoachBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime


class CoachPhotoOut(BaseModel):
    """對應「新增教練」教練照片上傳：回傳可存入 photo_url 的相對網址。"""

    url: str
