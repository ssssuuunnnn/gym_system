from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.hour_ledger import HourLedgerReason


class PurchaseCreate(BaseModel):
    """對應「購買紀錄登錄」：選擇會員（不限教練身份）、選擇商品、數量、購買日期、金額。"""

    user_id: int
    product_id: int
    quantity: int
    purchase_date: date
    amount: float


class PurchaseSelfCreate(BaseModel):
    """對應會員「購買商品」：僅需商品與數量，歸屬對象／金額／日期由後端帶入。"""

    product_id: int
    quantity: int = Field(default=1, ge=1)


class PurchaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    product_id: int
    quantity: int
    purchase_date: date
    amount: float
    remaining_hours: float
    created_by: int
    created_at: datetime


class HourLedgerOut(BaseModel):
    """堂數異動紀錄一筆。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    purchase_id: int
    reservation_id: int | None
    delta: float
    balance_after: float
    reason: HourLedgerReason
    note: str | None
    created_by: int | None
    created_at: datetime


class HourAdjustCreate(BaseModel):
    """管理員手動調整堂數：change 正數＝補堂、負數＝扣堂，note 必填（例如「更正重複登錄」）。"""

    change: Decimal
    note: str = Field(min_length=1, max_length=255)

    @field_validator("change")
    @classmethod
    def _non_zero(cls, v: Decimal) -> Decimal:
        if v == 0:
            raise ValueError("調整堂數不可為 0")
        return v
