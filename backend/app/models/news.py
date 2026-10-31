from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.tenant import TenantMixin


class NewsPost(TenantMixin, Base):
    """
    最新消息（見 docs/adr/0012-news-and-tags.md）：店家自己發的公告。
    發布後出現在形象網站「最新消息」段落與 /site/news/<id> 單篇頁面，也可以用 LINE 推給會員。
    """

    __tablename__ = "news_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    # 列表與 LINE 卡片上的一兩句摘要
    summary: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 只能是本店上傳到 /media/<子網域>/site/ 的圖片（與形象網站相同的檢查）
    image_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # 第一次發布的時間（網站上顯示的日期）；取消發布再發布不變
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    created_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    updated_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class NewsBroadcast(TenantMixin, Base):
    """
    一次 LINE 發送：對象（會員標籤＋會員名單條件）與當下的人數。
    每位收件人的發送結果在 line_member_messages（event＝最新消息，dedupe_key＝news:<消息 id>:<會員 id>）。
    不存收件人名單本身。
    """

    __tablename__ = "news_broadcasts"

    id: Mapped[int] = mapped_column(primary_key=True)
    news_id: Mapped[int] = mapped_column(ForeignKey("news_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    tag_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # 會員名單條件（SegmentFilters），沒用就是 None
    filters: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # 發送當下的說明，例如「標籤：VIP、早鳥班；會員名單：2026/8/1–10/31 上過課」
    target_label: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    matched_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    queued_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
