import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.tenant import TenantMixin


class ProductCategory(str, enum.Enum):
    course = "團體課程"  # 綁定已排程的團體課程，堂數沿用該課程課堂數
    single_course = "課程"  # 單次課程，堂數由管理員自填，不綁課程
    supply = "用品"  # 實體商品，有庫存


class Product(TenantMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[ProductCategory] = mapped_column(Enum(ProductCategory), nullable=False)
    # 分類為「團體課程」時綁定的團體課程；其餘分類為 None
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"), nullable=True)
    # 堂數：團體課程＝所綁課程的課堂數（後端同步）；課程＝管理員自填；用品＝0
    session_hours: Mapped[int] = mapped_column(nullable=False, comment="堂數，1堂＝1小時")
    # 分類為「用品」的庫存量，登錄購買時扣減；其餘分類為 None
    stock: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="用品庫存量")
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    course: Mapped["Course | None"] = relationship("Course")
