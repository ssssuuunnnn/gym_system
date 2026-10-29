from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.course import CourseStatus, ScheduleEndMode, SessionSource
from app.models.reservation import ReservationStatus


class CourseSessionIn(BaseModel):
    position: int = Field(ge=0)
    session_date: date
    start_minute: int = Field(ge=0, le=1439)
    duration_minutes: int = Field(ge=1, le=600)
    source: SessionSource
    is_cancelled: bool = False


class CourseSessionOut(CourseSessionIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class _CourseSchedule(BaseModel):
    """排程規格（掛在課程上，非規則清單）。"""

    weekdays: list[int] = Field(default_factory=list)  # ISO 1–7
    start_hour: int | None = Field(default=None, ge=0, le=23)
    start_date: date | None = None
    end_mode: ScheduleEndMode | None = None
    end_date: date | None = None
    week_count: int | None = Field(default=None, ge=1, le=104)


class CourseCreate(_CourseSchedule):
    name: str
    coach_id: int
    # 上課分店（ADR 0007）；省略＝預設分店
    branch_id: int | None = None
    duration_minutes: int = Field(default=60, ge=1, le=600)
    min_capacity: int = Field(default=1, ge=1, le=100)
    max_capacity: int = Field(ge=1, le=100)
    coach_fee: float = Field(default=0, ge=0)
    description: str | None = None
    cover_image_url: str | None = None
    status: CourseStatus = CourseStatus.draft
    sessions: list[CourseSessionIn] = Field(default_factory=list)


class CourseUpdate(BaseModel):
    name: str | None = None
    coach_id: int | None = None
    branch_id: int | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=600)
    min_capacity: int | None = Field(default=None, ge=1, le=100)
    max_capacity: int | None = Field(default=None, ge=1, le=100)
    coach_fee: float | None = Field(default=None, ge=0)
    description: str | None = None
    cover_image_url: str | None = None
    status: CourseStatus | None = None
    weekdays: list[int] | None = None
    start_hour: int | None = Field(default=None, ge=0, le=23)
    start_date: date | None = None
    end_mode: ScheduleEndMode | None = None
    end_date: date | None = None
    week_count: int | None = Field(default=None, ge=1, le=104)
    sessions: list[CourseSessionIn] | None = None


class CourseStatusUpdate(BaseModel):
    status: CourseStatus


class CourseCoverOut(BaseModel):
    url: str


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str | None
    coach_id: int
    branch_id: int
    day_of_week: int | None
    start_hour: int | None
    duration_minutes: int
    min_capacity: int
    max_capacity: int
    # 每堂教練費：非管理員讀取時為 None
    coach_fee: float | None = None
    session_count: int
    description: str | None
    cover_image_url: str | None
    start_date: date | None
    end_date: date | None
    end_mode: ScheduleEndMode | None
    week_count: int | None
    weekdays: list[int] = Field(default_factory=list)
    status: CourseStatus
    is_archived: bool
    archived_at: datetime | None
    archived_by_name: str | None
    enrolled_count: int = 0
    created_at: datetime
    updated_at: datetime
    updated_by_name: str | None


class CourseDetailOut(CourseOut):
    sessions: list[CourseSessionOut] = Field(default_factory=list)


class ScheduleSessionOut(BaseModel):
    """
    會員「預約課程」用的團體課表：一列＝一堂可預約的課（上架、未封存、未停課）。
    booked_count 含待確認與已確認（避免超收）；my_reservation_* 為登入者在這堂的有效預約。
    """

    course_id: int
    course_name: str
    cover_image_url: str | None
    coach_id: int
    coach_name: str
    branch_id: int
    branch_name: str
    session_date: date
    start_minute: int
    duration_minutes: int
    max_capacity: int
    booked_count: int
    my_reservation_id: int | None
    my_reservation_status: ReservationStatus | None


class CoachCourseSessionOut(BaseModel):
    """對應「教練課程」頁：某教練所有未封存課程的逐堂課堂（含所屬課程名稱）。"""

    course_id: int
    course_name: str
    course_code: str | None
    course_status: CourseStatus
    session_date: date
    start_minute: int
    duration_minutes: int
    source: SessionSource
    is_cancelled: bool
