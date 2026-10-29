import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.tenant import TenantMixin


class CoachType(str, enum.Enum):
    """教練類型（可複選，但場租教練不屬於公司，不能與其他類型並存）。見 docs/business-rules.md R14。"""

    private = "私人教練"  # 隸屬公司，私人課依教練個人的每堂鐘點費計費
    group = "團體課程教練"  # 隸屬公司，團體課依課程設定的每堂教練費計費
    rental = "場租教練"  # 不屬於公司，來租借場地，不計鐘點


class Coach(TenantMixin, Base):
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
    # 私人課每堂鐘點費（私人教練適用；團體課改用課程的 coach_fee），僅管理員可見
    session_rate: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False, server_default="0", default=0, comment="私人課每堂鐘點費"
    )
    # 教練類型（可複選）
    is_private_coach: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="1", default=True, comment="私人教練"
    )
    is_group_coach: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="0", default=False, comment="團體課程教練"
    )
    is_rental_coach: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="0", default=False, comment="場租教練"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="coach_profile", foreign_keys=[user_id])
    branch_rows: Mapped[list["CoachBranch"]] = relationship(
        "CoachBranch", cascade="all, delete-orphan", order_by="CoachBranch.branch_id"
    )

    @property
    def branch_ids(self) -> list[int]:
        """授課分店（見 ADR 0007）"""
        return [r.branch_id for r in self.branch_rows]

    @branch_ids.setter
    def branch_ids(self, ids: list[int]) -> None:
        from app.models.branch import CoachBranch, sync_branch_rows

        sync_branch_rows(self.branch_rows, ids, lambda b: CoachBranch(branch_id=b))

    @property
    def coach_types(self) -> list[CoachType]:
        types = []
        if self.is_private_coach:
            types.append(CoachType.private)
        if self.is_group_coach:
            types.append(CoachType.group)
        if self.is_rental_coach:
            types.append(CoachType.rental)
        return types

    @coach_types.setter
    def coach_types(self, types: list[CoachType]) -> None:
        self.is_private_coach = CoachType.private in types
        self.is_group_coach = CoachType.group in types
        self.is_rental_coach = CoachType.rental in types
