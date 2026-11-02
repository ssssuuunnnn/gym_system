import enum
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, ForeignKey, Numeric, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.purchase import PaymentMethod
from app.models.tenant import TenantMixin


class EntryKind(str, enum.Enum):
    income = "收入"
    expense = "支出"


class AccountingCategory(TenantMixin, Base):
    """
    手動記帳的分類（ADR 0014、R59）：收入、支出各自一組。第一次讀取時建立預設分類。
    用過的分類不能刪除，只能停用。
    """

    __tablename__ = "accounting_categories"
    __table_args__ = (UniqueConstraint("tenant_id", "kind", "name", name="uq_accounting_categories_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[EntryKind] = mapped_column(Enum(EntryKind), nullable=False)
    name: Mapped[str] = mapped_column(String(30), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class AccountingEntry(TenantMixin, Base):
    """
    手動帳目（ADR 0014、R59）：系統沒有記錄的收入與支出（房租、水電、場租收入…）。
    branch_id 為 NULL＝全店共同。刪除為軟刪除（deleted_at），報表不計。
    """

    __tablename__ = "accounting_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[EntryKind] = mapped_column(Enum(EntryKind), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("accounting_categories.id"), nullable=False, index=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True, comment="收付日期（店家當地日期）")
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), nullable=False)
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("branches.id"), nullable=True, index=True)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    updated_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 收據（ADR 0015、R64）：PRIVATE_MEDIA_DIR 底下的相對路徑，不對外公開
    receipt_path: Mapped[str | None] = mapped_column(String(200), nullable=True)

    category: Mapped["AccountingCategory"] = relationship("AccountingCategory")

    @property
    def category_name(self) -> str:
        return self.category.name

    @property
    def has_receipt(self) -> bool:
        return bool(self.receipt_path)


class AccountingClose(TenantMixin, Base):
    """
    關帳（ADR 0015、R63）：每家每月一列。is_closed 時該月的手動帳目鎖定。
    snapshot＝關帳當下該月現金制／權責制的收入、支出、淨額與月底預收款。重新開帳只留最後一次的紀錄。
    """

    __tablename__ = "accounting_closes"
    __table_args__ = (UniqueConstraint("tenant_id", "period", name="uq_accounting_closes_period"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    period: Mapped[date] = mapped_column(Date, nullable=False, comment="月份（該月 1 日）")
    is_closed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    closed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    closed_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reopened_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reopened_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
