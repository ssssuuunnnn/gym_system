from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.accounting import EntryKind
from app.models.purchase import PaymentMethod

# 手動帳目可選的付款方式（「體驗券」只用於兌換體驗券，不能手動記帳）
ENTRY_PAYMENT_METHODS = [PaymentMethod.cash, PaymentMethod.transfer, PaymentMethod.card, PaymentMethod.other]


class CategoryCreate(BaseModel):
    kind: EntryKind
    name: str = Field(min_length=1, max_length=30)

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("請輸入分類名稱")
        return v


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=30)
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=999)

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("請輸入分類名稱")
        return v


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: EntryKind
    name: str
    is_active: bool
    sort_order: int
    in_use: bool = False


class EntryIn(BaseModel):
    """新增／修改手動帳目（R59）。"""

    kind: EntryKind
    category_id: int
    entry_date: date
    amount: float = Field(gt=0, le=99_999_999)
    payment_method: PaymentMethod
    # 不填＝全店共同
    branch_id: int | None = None
    note: str | None = Field(default=None, max_length=200)

    @field_validator("payment_method")
    @classmethod
    def _method(cls, v: PaymentMethod) -> PaymentMethod:
        if v not in ENTRY_PAYMENT_METHODS:
            raise ValueError("付款方式只能是現金、轉帳、刷卡或其他")
        return v

    @field_validator("note")
    @classmethod
    def _note(cls, v: str | None) -> str | None:
        return (v or "").strip() or None


class EntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: EntryKind
    category_id: int
    category_name: str
    entry_date: date
    amount: float
    payment_method: PaymentMethod
    branch_id: int | None
    note: str | None
    created_by_name: str | None
    updated_by_name: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    deleted_by_name: str | None


class ReportLine(BaseModel):
    key: str
    label: str
    source: str
    amount: float
    count: int


class PaymentMethodLine(BaseModel):
    method: str
    amount: float
    count: int


class SharedTotals(BaseModel):
    income: float
    expense: float


class ReportOut(BaseModel):
    start: date
    end: date
    branch_id: int | None
    income: float
    expense: float
    net: float
    income_lines: list[ReportLine]
    expense_lines: list[ReportLine]
    payment_methods: list[PaymentMethodLine]
    discount_total: float
    zero_amount_count: int
    # 看單一分店時：全店共同（沒有指定分店）的手動帳目金額
    shared: SharedTotals | None


class TrendPoint(BaseModel):
    month: str
    income: float
    expense: float
    net: float


class TransactionOut(BaseModel):
    date: date
    kind: EntryKind
    source: str
    category_key: str
    category: str
    description: str
    amount: float
    payment_method: str | None
    branch_id: int | None
    ref_id: int
