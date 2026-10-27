"""
形象網站（見 docs/adr/0003-gym-website.md）：每家健身房一筆，內容存成一份 JSON 文件。

- draft：後台編輯中的版本；按「發布」時整份複製到 published。
- published：訪客看到的版本；為空表示網站未上線（首頁導向登入頁）。
- 內容格式由 schemas/website.py 的 SiteContent 定義與驗證；教練、課表、方案只存 id 與網站用文字，
  名稱、照片、價格、課堂每次顯示時從系統資料讀取。
"""

from datetime import datetime

from sqlalchemy import JSON, DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.tenant import TenantMixin


class Website(TenantMixin, Base):
    __tablename__ = "websites"
    __table_args__ = (UniqueConstraint("tenant_id", name="uq_websites_tenant"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    draft: Mapped[dict] = mapped_column(JSON, nullable=False, comment="編輯中的內容")
    published: Mapped[dict | None] = mapped_column(JSON, nullable=True, comment="線上內容；空＝未上線")
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    published_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
