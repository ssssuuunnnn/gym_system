from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.course import CourseStatus


class CourseCreate(BaseModel):
    name: str
    coach_id: int
    day_of_week: int
    start_hour: int
    duration_minutes: int = 60
    min_capacity: int = Field(default=1, ge=1, le=100)
    max_capacity: int = Field(ge=1, le=100)
    session_count: int = Field(default=0, ge=0)
    description: str | None = None
    cover_image_url: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: CourseStatus = CourseStatus.draft


class CourseUpdate(BaseModel):
    name: str | None = None
    coach_id: int | None = None
    day_of_week: int | None = None
    start_hour: int | None = None
    duration_minutes: int | None = Field(default=None, ge=1)
    min_capacity: int | None = Field(default=None, ge=1, le=100)
    max_capacity: int | None = Field(default=None, ge=1, le=100)
    session_count: int | None = Field(default=None, ge=0)
    description: str | None = None
    cover_image_url: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: CourseStatus | None = None


class CourseStatusUpdate(BaseModel):
    status: CourseStatus


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str | None
    coach_id: int
    day_of_week: int
    start_hour: int
    duration_minutes: int
    min_capacity: int
    max_capacity: int
    session_count: int
    description: str | None
    cover_image_url: str | None
    start_date: date | None
    end_date: date | None
    status: CourseStatus
    enrolled_count: int = 0
    created_at: datetime
    updated_at: datetime
    updated_by_name: str | None
