from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TimeSlotUpdate(BaseModel):
    """對應「時段開放設定」：逐格切換開放／關閉。"""

    day_of_week: int
    start_hour: int
    is_open: bool


class TimeSlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    day_of_week: int
    start_hour: int
    is_open: bool
    updated_by: int | None
    updated_at: datetime
