"""
匯入所有 Model，確保 Base.metadata 收集到全部資料表（供 Alembic autogenerate 與
create_all 使用）。對應「資料庫結構設計」章節的資料表（另含團體課程的
course_weekdays / course_sessions 兩張子表）。
"""

from app.models.coach import Coach  # noqa: F401
from app.models.course import (  # noqa: F401
    Course,
    CourseSession,
    CourseStatus,
    CourseWeekday,
    ScheduleEndMode,
    SessionSource,
)
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
