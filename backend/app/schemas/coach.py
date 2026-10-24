from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.coach import CoachType


def _validate_types(types: list[CoachType]) -> list[CoachType]:
    """至少一種；場租教練不屬於公司，不能與私人教練／團體課程教練並存（R14）。"""
    unique = list(dict.fromkeys(types))
    if not unique:
        raise ValueError("請至少選擇一種教練類型")
    if CoachType.rental in unique and len(unique) > 1:
        raise ValueError("場租教練不能與私人教練、團體課程教練同時勾選")
    return unique


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
    coach_types: list[CoachType] = Field(default_factory=lambda: [CoachType.private])

    @field_validator("coach_types")
    @classmethod
    def _types(cls, v: list[CoachType]) -> list[CoachType]:
        return _validate_types(v)


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
    coach_types: list[CoachType] = Field(default=None)  # type: ignore[assignment]

    @field_validator("coach_types")
    @classmethod
    def _types(cls, v: list[CoachType]) -> list[CoachType]:
        return _validate_types(v)


class CoachOut(BaseModel):
    """
    非管理員讀取教練列表時，電話、Line、匯款帳號與鐘點費會被清空（見 routers/coaches.py list_coaches），
    因此這些欄位在輸出時允許為 None。教練類型對所有人公開（預約畫面用來篩選）。
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    alias: str | None
    line_name: str | None
    phone: str | None
    bank_code: str | None
    bank_account: str | None
    specialty: str | None
    photo_url: str | None
    session_rate: float | None
    coach_types: list[CoachType]
    created_at: datetime


class CoachPhotoOut(BaseModel):
    """對應「新增教練」教練照片上傳：回傳可存入 photo_url 的相對網址。"""

    url: str
