from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.tenant import TenantMixin

# 標籤顏色只能從這幾個挑（前端用 antd Tag 的預設色）
TAG_COLORS = ("blue", "green", "gold", "orange", "red", "magenta", "purple", "cyan", "geekblue", "default")


class MemberTag(TenantMixin, Base):
    """
    會員標籤（見 docs/adr/0012-news-and-tags.md）：店家自訂，例如「VIP」「早鳥班」「孕婦」。
    在會員詳情幫每位會員貼標籤；會員列表、會員名單可依標籤篩選；最新消息可以發給某些標籤的會員。
    """

    __tablename__ = "member_tags"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_member_tags_tenant_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(20), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="blue")
    created_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class MemberTagLink(TenantMixin, Base):
    """會員 ↔ 標籤（多對多）。"""

    __tablename__ = "member_tag_links"
    __table_args__ = (UniqueConstraint("tag_id", "user_id", name="uq_member_tag_links"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("member_tags.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    added_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
