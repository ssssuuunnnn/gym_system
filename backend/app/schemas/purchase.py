from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class PurchaseCreate(BaseModel):
    """對應「購買紀錄登錄」：選擇會員（不限教練身份）、選擇商品、數量、購買日期、金額。"""

    user_id: int
    product_id: int
    quantity: int
    purchase_date: date
    amount: float


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
