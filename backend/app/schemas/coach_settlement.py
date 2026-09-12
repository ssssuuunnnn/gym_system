import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SettlementRatesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_course_rate: Decimal
    private_rate: Decimal
    venue_rental_rate: Decimal
    updated_at: datetime


class SettlementRatesUpdate(BaseModel):
    group_course_rate: Decimal | None = Field(default=None, ge=0)
    private_rate: Decimal | None = Field(default=None, ge=0)
    venue_rental_rate: Decimal | None = Field(default=None, ge=0)


class SettlementSessionDetail(BaseModel):
    """展開列的單堂明細：目前僅團體課程有實際資料，一對一／場租留待日後串接。"""

    session_type: Literal["團體課程", "一對一", "場租"]
    course_name: str
    session_date: date
    start_minute: int
    duration_minutes: int
    rate: Decimal
    subtotal: Decimal


class SettlementStatus(str, enum.Enum):
    pending = "待確認"
    locked = "已鎖定"


class CoachSettlementRow(BaseModel):
    coach_id: int
    coach_name: str
    group_course_count: int
    # 一對一、場租目前無資料來源可結算，固定回傳 0
    private_count: int = 0
    venue_rental_count: int = 0
    payable_amount: Decimal
    status: SettlementStatus
    sessions: list[SettlementSessionDetail] = Field(default_factory=list)


class CoachSettlementSummary(BaseModel):
    """對應「教練費用結算」頁：某月份的教練結算清單。"""

    year: int
    month: int
    period_start: date
    period_end: date
    coach_count: int
    total_payable: Decimal
    is_locked: bool
    locked_at: datetime | None
    rows: list[CoachSettlementRow] = Field(default_factory=list)


class SettlementLockRequest(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
