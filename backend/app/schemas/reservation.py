from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.reservation import Attendance, ReservationSource, ReservationStatus


class ReservationCreate(BaseModel):
    """
    對應「送出預約申請」（source=member_submitted，狀態預設待確認）與
    「管理員建立預約」（source=admin_created，狀態預設已確認，另在路由層設定）。
    """

    member_id: int
    coach_id: int | None = None
    course_id: int | None = None
    product_id: int
    purchase_id: int | None = None
    booking_date: date
    start_hour: int
    people_count: int = 1
    notes: str | None = None


class ReservationReview(BaseModel):
    """對應「預約審核列表／詳情」：核准／拒絕。"""

    status: ReservationStatus


class ReservationUpdate(BaseModel):
    """對應「我的預約」編輯：僅待確認狀態可編輯，且僅開放日期／時段／人數／備註。"""

    booking_date: date | None = None
    start_hour: int | None = None
    people_count: int | None = None
    notes: str | None = None


class ReservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_id: int
    coach_id: int | None
    course_id: int | None
    product_id: int
    purchase_id: int | None
    booking_date: date
    start_hour: int
    people_count: int
    status: ReservationStatus
    source: ReservationSource
    notes: str | None
    created_at: datetime
    reviewed_by: int | None
    reviewed_at: datetime | None
    cancelled_at: datetime | None
    late_cancel: bool
    attendance: Attendance | None
    checked_in_at: datetime | None
    checked_in_by: int | None


class CoachingReservationOut(ReservationOut):
    """教練簽到列表：教練無法讀取會員清單，因此直接附上學員帳號。"""

    member_username: str


class ReservationCancel(BaseModel):
    """
    取消預約。refund 僅管理員可指定：省略時依取消期限規則決定是否退堂（期限內取消不退）；
    管理員可傳 true／false 覆寫（例如因病情有可原，期限內仍退堂）。
    """

    refund: bool | None = None


class AttendanceMark(BaseModel):
    """標記出席狀態。學員本人只能在時間窗內標記「已出席」；教練／管理員可標記已出席或未到。"""

    attendance: Attendance


class ReservationAddonCreate(BaseModel):
    """對應「加購臨時加人 (3b)」：僅教練身份會員可用。"""

    reservation_id: int
    product_id: int
    extra_people: int
    purchase_id: int | None = None


class ReservationAddonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reservation_id: int
    product_id: int
    extra_people: int
    purchase_id: int | None
    created_at: datetime
