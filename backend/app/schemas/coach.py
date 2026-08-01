from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CoachCreate(BaseModel):
    user_id: int
    name: str
    phone: str


class CoachUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None


class CoachOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    phone: str
    created_at: datetime
