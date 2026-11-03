import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class TenantStatus(str, enum.Enum):
    trial = "試用"
    active = "啟用"
    suspended = "停用"


class BusinessType(str, enum.Enum):
    """行業類型（ADR 0011）：決定前後台的用詞與預設功能。資料庫存成員名稱。"""

    fitness = "健身"
    beauty = "美體"


class Tenant(Base):
    """
    租戶＝一家健身房（一間公司）。見 docs/adr/0001-multi-tenancy.md。
    本表沒有 RLS：應用程式依子網域查詢租戶，只有讀取權限；新增／修改／停用由平台管理後台（PLATFORM_DB_ROLE）或 CLI（owner）執行。
    """

    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="健身房名稱（平台管理用）")
    subdomain: Mapped[str] = mapped_column(String(63), unique=True, nullable=False, comment="子網域，例如 pulsefit")
    status: Mapped[TenantStatus] = mapped_column(
        Enum(TenantStatus), nullable=False, server_default="trial", default=TenantStatus.trial
    )
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, server_default="Asia/Taipei", default="Asia/Taipei", comment="營業所在時區"
    )
    business_type: Mapped[BusinessType] = mapped_column(
        Enum(BusinessType), nullable=False, server_default="fitness", default=BusinessType.fitness, comment="行業類型"
    )
    contact_name: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="聯絡人")
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="聯絡 Email")
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="聯絡電話")
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True, comment="平台內部備註")
    # 試用到期時間（UTC）：只在狀態為「試用」時生效；NULL＝不限期（ADR 0013）
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="試用到期時間（UTC）")
    # self＝形象頁自助申請；平台或 CLI 開通的是 NULL
    signup_source: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="self＝形象頁自助申請")
    # 開店設定清單全部完成時送的試用天數（ADR 0016、R66）：送過的時間，每家只送一次
    setup_bonus_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    line_monthly_cap: Mapped[int] = mapped_column(
        Integer, nullable=False, default=300, server_default="300", comment="LINE 通知每月上限（則）"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, server_default=func.now()
    )


def trial_expired(status: TenantStatus | str, trial_ends_at: datetime | None, now: datetime | None = None) -> bool:
    """試用中且已過到期時間（ADR 0013）。轉為啟用或停用後不看到期時間。"""
    is_trial = status == TenantStatus.trial or status == "trial"
    return bool(is_trial and trial_ends_at is not None and (now or datetime.utcnow()) >= trial_ends_at)


class TenantMixin:
    """
    所有業務資料表都要繼承：加上 tenant_id。
    - 新增資料時由 app.db.session 的 before_flush 自動填入目前租戶。
    - 讀寫隔離由 PostgreSQL RLS 強制（migration 中對每張表呼叫 enable_tenant_rls）。
    """

    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True, comment="所屬租戶"
    )
