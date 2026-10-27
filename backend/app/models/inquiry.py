"""
體驗課詢問（見 docs/adr/0003-gym-website.md）：形象網站「預約體驗課」表單送出的資料與跟進紀錄。
內含訪客個資：只有該家管理員看得到；「未成交」超過保存期限會被刪除。
"""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.tenant import TenantMixin


class InquiryStatus(str, enum.Enum):
    new = "新詢問"
    contacting = "聯絡中"
    trial_booked = "已約體驗"
    converted = "已成為會員"
    lost = "未成交"


class Inquiry(TenantMixin, Base):
    __tablename__ = "inquiries"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    line_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    interest: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="想體驗")
    preferred_slot: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="方便時段")
    message: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="想對教練說的")
    status: Mapped[InquiryStatus] = mapped_column(
        Enum(InquiryStatus), nullable=False, default=InquiryStatus.new, server_default="new"
    )
    consent_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="同意個資蒐集的時間")
    # 送出者 IP 的雜湊（不存原始 IP），只用於限制送出頻率
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    member_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, comment="轉成會員後的帳號"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    notes: Mapped[list["InquiryNote"]] = relationship(
        "InquiryNote", back_populates="inquiry", cascade="all, delete-orphan", order_by="InquiryNote.created_at"
    )


class InquiryNote(TenantMixin, Base):
    """跟進紀錄：只新增，不修改。"""

    __tablename__ = "inquiry_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    inquiry_id: Mapped[int] = mapped_column(ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True)
    text: Mapped[str] = mapped_column(String(500), nullable=False)
    created_by_name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    inquiry: Mapped[Inquiry] = relationship("Inquiry", back_populates="notes")
