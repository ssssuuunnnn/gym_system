"""
匯入所有 Model，確保 Base.metadata 收集到全部資料表（供 Alembic autogenerate 與
create_all 使用）。對應「資料庫結構設計」章節的 9 張資料表。
"""

from app.models.coach import Coach  # noqa: F401
from app.models.course import Course, CourseStatus  # noqa: F401
from app.models.product import Product, ProductCategory  # noqa: F401
from app.models.purchase import Purchase  # noqa: F401
from app.models.reservation import (  # noqa: F401
    Reservation,
    ReservationAddon,
    ReservationSource,
    ReservationStatus,
)
from app.models.time_slot import TimeSlot  # noqa: F401
from app.models.user import User, UserRole  # noqa: F401
