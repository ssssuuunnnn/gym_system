from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CoachBase(BaseModel):
    name: str
    alias: str | None = None
    line_name: str | None = None
    phone: str
    bank_code: str | None = None
    bank_account: str | None = None
    specialty: str | None = None
    photo_url: str | None = None
    session_rate: float = Field(default=0, ge=0)


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
    # 省略＝不變更；不接受 null（欄位不可為空）
    session_rate: float = Field(default=None, ge=0)  # type: ignore[assignment]


class CoachOut(CoachBase):
    """
    非管理員讀取時，電話、Line、匯款帳號與鐘點費會被清空（見 routers/coaches.py list_coaches），
    因此這些欄位在輸出時允許為 None。
    """

    model_config = ConfigDict(from_attributes=True)

    phone: str | None
    session_rate: float | None
    id: int
    user_id: int
    created_at: datetime


class CoachPhotoOut(BaseModel):
    """對應「新增教練」教練照片上傳：回傳可存入 photo_url 的相對網址。"""

    url: str
