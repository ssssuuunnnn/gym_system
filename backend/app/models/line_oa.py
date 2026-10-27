from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.tenant import TenantMixin


class LineOaChannel(TenantMixin, Base):
    """
    健身房自己的 LINE 官方帳號（見 docs/adr/0005-gym-line-oa.md），每家一筆。
    Messaging API channel（Webhook、底部選單、回覆）與同一個 Provider 底下的 LINE 登入 channel＋LIFF（會員在 LINE 裡登入）。
    channel secret 與 access token 以 core.crypto 加密，不回傳給前端。
    """

    __tablename__ = "line_oa_channels"
    __table_args__ = (UniqueConstraint("tenant_id", name="uq_line_oa_channels_tenant"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    channel_secret_enc: Mapped[str] = mapped_column(Text, nullable=False)
    access_token_enc: Mapped[str] = mapped_column(Text, nullable=False)
    login_channel_id: Mapped[str] = mapped_column(String(20), nullable=False)
    liff_id: Mapped[str] = mapped_column(String(64), nullable=False)
    # 「檢查連線」成功才啟用；改了任何金鑰／ID 都要重新檢查
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # 從 LINE 讀回的官方帳號資料
    bot_basic_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    bot_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bot_picture_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rich_menu_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    updated_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
