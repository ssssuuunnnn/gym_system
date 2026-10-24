from datetime import datetime

from sqlalchemy import DateTime, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class SystemSettings(Base):
    """系統設定：全站僅一筆（singleton），無外鍵。對應「系統設定 → 基本資料」畫面。"""

    __tablename__ = "system_settings"

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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
