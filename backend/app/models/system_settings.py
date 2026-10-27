from datetime import datetime

from sqlalchemy import DateTime, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.tenant import TenantMixin


class SystemSettings(TenantMixin, Base):
    """系統設定：每個租戶一筆。對應「系統設定 → 基本資料」畫面。"""

    __tablename__ = "system_settings"
    __table_args__ = (UniqueConstraint("tenant_id", name="uq_system_settings_tenant"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    company_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # 顯示簡稱：側欄與行動版顯示用，留空則顯示公司名稱
    short_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 公司 LOGO：以 /media 靜態路徑對外提供的相對網址
    logo_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # 取消期限：已確認的預約在開課前 N 小時內取消不退堂；0＝不限制
    cancel_deadline_hours: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="12", default=12, comment="取消期限（開課前小時數）"
    )
    # 付款方式說明（例如轉帳帳號）：會員下單後在「我的商品」看到，見 ADR 0005
    payment_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
