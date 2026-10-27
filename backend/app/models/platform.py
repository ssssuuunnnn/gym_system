"""
平台層級資料表（見 docs/adr/0002-platform-console.md）：不屬於任何健身房，沒有 tenant_id、沒有 RLS。
應用程式帳號（APP_DB_ROLE）對這些表沒有任何權限，只有平台帳號（PLATFORM_DB_ROLE）能讀寫。
"""

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base

# 不屬於任何租戶的資料表（tests/test_tenancy.py 據此檢查其他表都有 tenant_id 與 RLS）
PLATFORM_TABLE_NAMES = {"tenants", "platform_admins", "platform_audit_logs", "line_bind_attempts"}


class PlatformAdmin(Base):
    """平台管理員：開通／停用健身房的人。與任何健身房的帳號無關。"""

    __tablename__ = "platform_admins"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class PlatformAuditLog(Base):
    """平台操作紀錄：誰在什麼時候對哪家健身房做了什麼。只新增、不修改。"""

    __tablename__ = "platform_audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("platform_admins.id", ondelete="SET NULL"), nullable=True, comment="操作者；CLI 操作為空"
    )
    admin_username: Mapped[str] = mapped_column(String(100), nullable=False, comment="操作者帳號快照")
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True, comment="被操作的健身房"
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False, comment="操作代碼，見 services/tenants.py AUDIT_ACTIONS")
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True, comment="變更內容（不含密碼）")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
