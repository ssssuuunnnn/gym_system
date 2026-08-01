from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CourseCreate(BaseModel):
    name: str
    coach_id: int
    day_of_week: int
    start_hour: int
    max_capacity: int = Field(ge=3, le=8)


class CourseUpdate(BaseModel):
    name: str | None = None
    coach_id: int | None = None
    day_of_week: int | None = None
    start_hour: int | None = None
    max_capacity: int | None = Field(default=None, ge=3, le=8)


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    coach_id: int
    day_of_week: int
    start_hour: int
    max_capacity: int
    created_at: datetime
