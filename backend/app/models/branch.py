from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.tenant import TenantMixin

DEFAULT_BRANCH_NAME = "總店"


class Branch(TenantMixin, Base):
    """
    分店（見 docs/adr/0007-branches.md）：同一家公司（租戶）底下的營業地點，網址、帳號、LINE 官方帳號都共用。
    課程、公休時段、預約屬於一間分店；教練可在多間分店授課；方案預設全分店通用、可限定分店。
    每家至少一間；沒有任何分店時由 services/branches.default_branch 自動建立「總店」。
    """

    __tablename__ = "branches"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_branches_tenant_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    address: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # 停用的分店不能再新增課程與預約，既有資料保留
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class CoachBranch(TenantMixin, Base):
    """教練授課的分店（多選，至少一間）。"""

    __tablename__ = "coach_branches"
    __table_args__ = (UniqueConstraint("coach_id", "branch_id", name="uq_coach_branch"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("coaches.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)

    branch: Mapped["Branch"] = relationship("Branch")


class ProductBranch(TenantMixin, Base):
    """方案限定使用的分店；沒有任何列＝全分店通用（R35）。"""

    __tablename__ = "product_branches"
    __table_args__ = (UniqueConstraint("product_id", "branch_id", name="uq_product_branch"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)


def sync_branch_rows(rows: list, wanted: list[int], factory) -> None:
    """逐列增刪關聯（不整批重建，避免同一次 flush 先 INSERT 後 DELETE 撞到唯一鍵）。"""
    want = list(dict.fromkeys(wanted))
    existing = {r.branch_id: r for r in rows}
    for branch_id, row in existing.items():
        if branch_id not in want:
            rows.remove(row)
    for branch_id in want:
        if branch_id not in existing:
            rows.append(factory(branch_id))
