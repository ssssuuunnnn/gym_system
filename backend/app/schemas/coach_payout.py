import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.coach_payout import PayoutItemKind, PayoutStatus

_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def parse_month(value: str) -> date:
    """'YYYY-MM' → 該月 1 日。"""
    if not _MONTH_RE.match(value):
        raise ValueError("月份格式須為 YYYY-MM")
    year, month = value.split("-")
    return date(int(year), int(month), 1)


class PayoutItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kind: PayoutItemKind
    course_id: int | None
    title: str
    session_date: date
    start_hour: int
    attended_count: int
    no_show_count: int
    members: str


class CoachPayoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    coach_id: int
    period: date
    session_count: int
    rate: float
    amount: float
    status: PayoutStatus
    settled_at: datetime
    settled_by: int
    paid_at: datetime | None
    paid_by: int | None
    payment_note: str | None


class CoachPayoutDetailOut(CoachPayoutOut):
    items: list[PayoutItemOut]


class CoachPayoutSummaryRow(BaseModel):
    """月結總表的一列：即時計算值，加上該月已存在的結算紀錄（若有）。"""

    coach_id: int
    coach_name: str
    session_rate: float
    live_session_count: int
    live_amount: float
    payout: CoachPayoutOut | None
    # 已結算後出席紀錄又有異動，即時計算與快照不一致（需取消結算重算，或確認後忽略）
    changed_since_settled: bool


class CoachPayoutCreate(BaseModel):
    coach_id: int
    month: str = Field(description="YYYY-MM")

    @field_validator("month")
    @classmethod
    def _valid_month(cls, v: str) -> str:
        parse_month(v)
        return v


class PayoutMarkPaid(BaseModel):
    payment_note: str | None = Field(default=None, max_length=255)
