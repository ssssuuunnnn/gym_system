"""
匯入所有 Model，確保 Base.metadata 收集到全部資料表（供 Alembic autogenerate 與
create_all 使用）。對應「資料庫結構設計」章節的資料表（另含團體課程的
course_weekdays / course_sessions 兩張子表）。
"""

from app.models.tenant import Tenant, TenantMixin, TenantStatus  # noqa: F401
from app.models.platform import PLATFORM_TABLE_NAMES, PlatformAdmin, PlatformAuditLog  # noqa: F401
from app.models.coach import Coach  # noqa: F401
from app.models.coach_payout import CoachPayout, CoachPayoutItem, PayoutItemKind, PayoutStatus  # noqa: F401
from app.models.course import (  # noqa: F401
    Course,
    CourseSession,
    CourseStatus,
    CourseWeekday,
    ScheduleEndMode,
    SessionSource,
)
from app.models.hour_ledger import HourLedger, HourLedgerReason  # noqa: F401
from app.models.system_settings import SystemSettings  # noqa: F401
from app.models.product import Product, ProductCategory  # noqa: F401
from app.models.purchase import Purchase  # noqa: F401
from app.models.reservation import (  # noqa: F401
    Attendance,
    Reservation,
    ReservationAddon,
    ReservationSource,
    ReservationStatus,
)
from app.models.time_slot import TimeSlot  # noqa: F401
from app.models.user import User, UserRole  # noqa: F401
from app.models.website import Website  # noqa: F401,E402
from app.models.inquiry import Inquiry, InquiryNote, InquiryStatus  # noqa: F401,E402
from app.models.line import (  # noqa: F401,E402
    LineBindAttempt,
    LineBindCode,
    LineEvent,
    LineNotification,
    LineNotificationStatus,
    LineRecipient,
)
from app.models.line_oa import LineOaChannel  # noqa: F401,E402
