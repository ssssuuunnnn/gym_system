from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class TimeSlotUpdate(BaseModel):
    """對應「時段開放設定」：逐格切換某日期某時段的開放／關閉。"""

    slot_date: date
    start_hour: int
    is_open: bool


class TimeSlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slot_date: date
    start_hour: int
    is_open: bool
    updated_by: int | None
    updated_at: datetime
