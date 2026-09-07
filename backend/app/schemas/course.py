from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.course import (
    CourseStatus,
    ScheduleEndMode,
    ScheduleFrequency,
    SessionSource,
)


class CourseScheduleRuleIn(BaseModel):
    position: int = Field(ge=0)
    start_date: date
    start_minute: int = Field(ge=0, le=1439)
    frequency: ScheduleFrequency
    end_mode: ScheduleEndMode
    week_count: int | None = Field(default=None, ge=1, le=104)
    end_date: date | None = None


class CourseScheduleRuleOut(CourseScheduleRuleIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class CourseSessionIn(BaseModel):
    position: int = Field(ge=0)
    session_date: date
    start_minute: int = Field(ge=0, le=1439)
    duration_minutes: int = Field(ge=1, le=600)
    source: SessionSource
    rule_position: int | None = None
    adjusted: bool = False
    origin_date: date | None = None
    origin_minute: int | None = Field(default=None, ge=0, le=1439)


class CourseSessionOut(CourseSessionIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class CourseCreate(BaseModel):
    name: str
    coach_id: int
    duration_minutes: int = Field(default=60, ge=1, le=600)
    min_capacity: int = Field(default=1, ge=1, le=100)
    max_capacity: int = Field(ge=1, le=100)
    description: str | None = None
    cover_image_url: str | None = None
    status: CourseStatus = CourseStatus.draft
    rules: list[CourseScheduleRuleIn] = Field(default_factory=list)
    sessions: list[CourseSessionIn] = Field(default_factory=list)


class CourseUpdate(BaseModel):
    name: str | None = None
    coach_id: int | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=600)
    min_capacity: int | None = Field(default=None, ge=1, le=100)
    max_capacity: int | None = Field(default=None, ge=1, le=100)
    description: str | None = None
    cover_image_url: str | None = None
    status: CourseStatus | None = None
    rules: list[CourseScheduleRuleIn] | None = None
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
    day_of_week: int | None
    start_hour: int | None
    duration_minutes: int
    min_capacity: int
    max_capacity: int
    session_count: int
    description: str | None
    cover_image_url: str | None
    start_date: date | None
    end_date: date | None
    status: CourseStatus
    is_archived: bool
    archived_at: datetime | None
    archived_by_name: str | None
    enrolled_count: int = 0
    created_at: datetime
    updated_at: datetime
    updated_by_name: str | None


class CourseDetailOut(CourseOut):
    rules: list[CourseScheduleRuleOut] = Field(default_factory=list)
    sessions: list[CourseSessionOut] = Field(default_factory=list)
