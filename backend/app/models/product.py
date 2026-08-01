import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ProductCategory(str, enum.Enum):
    private_1v1 = "私人教練1對1"
    private_1v2 = "私人教練1對2"
    rental_1v1 = "場租1對1"
    buyout = "包場"
    group_class = "團體課"
    self_training = "自主訓練"
    extra_person = "臨時加人"
    hand_wrap = "手綁帶"


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[ProductCategory] = mapped_column(Enum(ProductCategory), nullable=False)
    session_hours: Mapped[int] = mapped_column(nullable=False, comment="堂數，1堂＝1小時")
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
