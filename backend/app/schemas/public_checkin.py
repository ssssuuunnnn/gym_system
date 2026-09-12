from datetime import date, datetime

from pydantic import BaseModel


class PublicCheckinEntryOut(BaseModel):
    """對應第二螢幕「名單看板」的單一磚：僅回傳可辨識身份用的最少欄位（本系統無獨立姓名欄位，故為 username）。"""

    reservation_id: int
    display_name: str
    checked_in: bool
    checked_in_at: datetime | None


class PublicCheckinSessionOut(BaseModel):
    course_id: int
    course_name: str
    booking_date: date
    start_hour: int


class PublicCheckinRosterOut(BaseModel):
    session: PublicCheckinSessionOut
    entries: list[PublicCheckinEntryOut]
    checked_in_count: int
    total_count: int


class PublicCheckinRequest(BaseModel):
    """course_id/booking_date/start_hour 須與 reservation_id 實際歸屬一致，避免跨堂課猜測/竄改。"""

    course_id: int
    booking_date: date
    start_hour: int
    reservation_id: int


class PublicCheckinResponse(BaseModel):
    reservation_id: int
    checked_in: bool
    checked_in_at: datetime | None
    already_checked_in: bool
