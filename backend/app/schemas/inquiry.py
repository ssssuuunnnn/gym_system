from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.inquiry import InquiryStatus


class InquiryNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    created_by_name: str
    created_at: datetime


class InquiryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str
    line_id: str | None
    interest: str | None
    preferred_slot: str | None
    message: str | None
    status: InquiryStatus
    member_user_id: int | None
    created_at: datetime
    updated_at: datetime
    notes: list[InquiryNoteOut] = []


class InquirySummary(BaseModel):
    new_count: int


class InquiryStatusUpdate(BaseModel):
    status: InquiryStatus


class InquiryNoteCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class InquiryConvert(BaseModel):
    """把詢問轉成會員帳號：帳號預設用手機號碼，密碼由管理員交給對方。"""

    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8)
    must_change_password: bool = True
    # 同時發一張體驗券（ADR 0010）
    coupon_id: int | None = None
