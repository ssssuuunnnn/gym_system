from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.reservation import ReservationSource, ReservationStatus


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
