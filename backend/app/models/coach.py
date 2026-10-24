from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Coach(Base):
    """教練資料：綁定帳號，唯一（一帳號僅能對應一筆教練資料）。不設狀態欄位。"""

    __tablename__ = "coaches"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # 授課名稱：課表與預約畫面對會員顯示的稱呼，留空則顯示姓名
    alias: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Line ID 或顯示名稱，僅供管理員聯繫用
    line_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    # 匯款帳號：教練鐘點費撥款用，僅管理員可見
    bank_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # 專長：擅長項目、證照、適合的學員類型
    specialty: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 教練照片：以 /media 靜態路徑對外提供的相對網址
    photo_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # 每堂鐘點費：教練鐘點結算用（出席／未到的堂數 × 費率），僅管理員可見
    session_rate: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False, server_default="0", default=0, comment="每堂鐘點費"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="coach_profile", foreign_keys=[user_id])
