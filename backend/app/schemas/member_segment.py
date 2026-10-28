from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

SegmentKind = Literal["全部", "團體課", "私人課"]
# 名單上每位會員能不能收到 LINE 行銷訊息
LineReach = Literal["可發送", "未綁定 LINE", "未同意優惠訊息"]

MAX_RANGE_DAYS = 366


class SegmentFilters(BaseModel):
    """會員名單篩選條件（R32）。「上過課」＝已確認且已出席的預約。"""

    start: date
    end: date
    kind: SegmentKind = "全部"
    coach_id: int | None = None
    # 期間內至少出席幾次
    min_attended: int = Field(default=1, ge=1, le=999)
    # 剩餘堂數（已付款方案加總）不超過；None＝不限
    max_remaining_hours: float | None = Field(default=None, ge=0)
    # 最後一次上課距今至少幾天；None＝不限
    inactive_days: int | None = Field(default=None, ge=1, le=3650)

    @model_validator(mode="after")
    def _check_range(self):
        if self.end < self.start:
            raise ValueError("結束日不能早於開始日")
        if (self.end - self.start).days >= MAX_RANGE_DAYS:
            raise ValueError("上課期間最長一年")
        return self


class SegmentMember(BaseModel):
    id: int
    name: str
    username: str
    phone: str | None
    attended_count: int
    last_attended: date
    remaining_hours: float
    reach: LineReach


class SegmentResult(BaseModel):
    total: int
    sendable: int
    no_line: int
    no_consent: int
    members: list[SegmentMember]


class AudienceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    filters: SegmentFilters


class AudienceOut(BaseModel):
    id: int
    name: str
    audience_group_id: int
    filters: dict
    member_count: int
    created_by_name: str | None
    created_at: datetime
