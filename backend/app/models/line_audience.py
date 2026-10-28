from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.tenant import TenantMixin


class LineAudience(TenantMixin, Base):
    """
    從「會員名單」上傳到健身房官方帳號的 LINE 受眾（見 docs/adr/0006-member-segments.md）。
    只記錄名稱、篩選條件與人數；LINE 使用者 ID 不留存（受眾在 LINE 那邊）。
    行銷訊息由健身房在 LINE 官方帳號後台選這個受眾發送。
    """

    __tablename__ = "line_audiences"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # LINE 的 audienceGroupId
    audience_group_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # 建立當下的篩選條件（SegmentFilters），讓之後看得出這群人是怎麼篩的
    filters: Mapped[dict] = mapped_column(JSON, nullable=False)
    member_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
