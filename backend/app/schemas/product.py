from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.product import ProductCategory


class ProductCreate(BaseModel):
    name: str
    category: ProductCategory
    price: float
    is_active: bool = True
    # 分類為「團體課程」時必填：所綁定的團體課程 id（堂數沿用該課程的課堂數）
    course_id: int | None = None
    # 分類為「課程」時必填：堂數（管理員自填）
    session_hours: int | None = None
    # 分類為「用品」時必填：庫存量
    stock: int | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    category: ProductCategory | None = None
    price: float | None = None
    is_active: bool | None = None
    course_id: int | None = None
    session_hours: int | None = None
    stock: int | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: ProductCategory
    course_id: int | None
    session_hours: int
    stock: int | None
    price: float
    is_active: bool
    created_at: datetime
