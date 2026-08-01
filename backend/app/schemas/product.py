from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.product import ProductCategory


class ProductCreate(BaseModel):
    name: str
    category: ProductCategory
    session_hours: int
    price: float
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: str | None = None
    category: ProductCategory | None = None
    session_hours: int | None = None
    price: float | None = None
    is_active: bool | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: ProductCategory
    session_hours: int
    price: float
    is_active: bool
    created_at: datetime
