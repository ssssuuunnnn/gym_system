from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BranchCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    address: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    sort_order: int = Field(default=0, ge=0, le=999)


class BranchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    address: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    sort_order: int | None = Field(default=None, ge=0, le=999)
    is_active: bool | None = None


class BranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: str | None
    phone: str | None
    is_active: bool
    sort_order: int
    created_at: datetime
