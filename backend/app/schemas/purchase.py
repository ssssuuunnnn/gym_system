from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.hour_ledger import HourLedgerReason
from app.models.purchase import PaymentMethod, PaymentStatus


class PurchaseCreate(BaseModel):
    """對應「購買紀錄登錄」：選擇會員（不限教練身份）、選擇商品、數量、購買日期、金額。"""

    user_id: int
    product_id: int
    quantity: int
    purchase_date: date
    amount: float
    # 管理員登錄即視為已收款；付款方式選填
    payment_method: PaymentMethod | None = None
    payment_note: str | None = Field(default=None, max_length=255)
    # 使用優惠券（ADR 0010）：有指定時金額改由後端以 商品單價 × 數量 − 折抵 計算，不採用 amount
    coupon_code: str | None = Field(default=None, max_length=30)
    member_coupon_id: int | None = None


class PurchaseSelfCreate(BaseModel):
    """對應會員「購買商品」：僅需商品與數量，歸屬對象／金額／日期由後端帶入。"""

    product_id: int
    quantity: int = Field(default=1, ge=1)
    # 使用優惠券：輸入公開代碼，或從「我的優惠券」挑一張（擇一）
    coupon_code: str | None = Field(default=None, max_length=30)
    member_coupon_id: int | None = None


class PurchaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    product_id: int
    quantity: int
    purchase_date: date
    amount: float
    # 使用優惠券時的原價、折抵金額與券名（ADR 0010）
    original_amount: float | None = None
    discount_amount: float = 0
    coupon_name: str | None = None
    total_hours: float
    remaining_hours: float
    payment_status: PaymentStatus
    payment_method: PaymentMethod | None
    payment_note: str | None
    paid_at: datetime | None
    paid_confirmed_by: int | None
    cancelled_at: datetime | None
    created_by: int
    created_at: datetime


class PaymentConfirm(BaseModel):
    """管理員確認收款：付款方式必填，備註選填（例如轉帳末五碼）。"""

    payment_method: PaymentMethod
    payment_note: str | None = Field(default=None, max_length=255)


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
