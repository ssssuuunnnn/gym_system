from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


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
