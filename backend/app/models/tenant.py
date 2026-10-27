import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class TenantStatus(str, enum.Enum):
    trial = "試用"
    active = "啟用"
    suspended = "停用"


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
    contact_name: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="聯絡人")
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="聯絡 Email")
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="聯絡電話")
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True, comment="平台內部備註")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, server_default=func.now()
    )


class TenantMixin:
    """
    所有業務資料表都要繼承：加上 tenant_id。
    - 新增資料時由 app.db.session 的 before_flush 自動填入目前租戶。
    - 讀寫隔離由 PostgreSQL RLS 強制（migration 中對每張表呼叫 enable_tenant_rls）。
    """

    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True, comment="所屬租戶"
    )
