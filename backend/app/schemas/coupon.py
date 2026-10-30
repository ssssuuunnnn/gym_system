import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.coupon import CouponKind, CouponSource, DiscountType

CODE_PATTERN = re.compile(r"^[A-Z0-9]{3,30}$")


class CouponIn(BaseModel):
    """建立／編輯優惠券（ADR 0010）。"""

    name: str = Field(min_length=1, max_length=60)
    kind: CouponKind
    description: str | None = Field(default=None, max_length=200)
    code: str | None = None
    discount_type: DiscountType | None = None
    discount_value: float | None = Field(default=None, gt=0)
    min_amount: float = Field(default=0, ge=0)
    product_ids: list[int] = Field(default_factory=list)
    trial_product_id: int | None = None
    counts_for_payout: bool = True
    issue_on_line_join: bool = False
    valid_from: date | None = None
    valid_until: date | None = None
    valid_days: int | None = Field(default=None, ge=1, le=3650)
    total_limit: int | None = Field(default=None, ge=1)
    per_member_limit: int = Field(default=1, ge=1, le=100)
    new_member_only: bool = False
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def _code(cls, v: str | None) -> str | None:
        v = (v or "").strip().upper()
        if not v:
            return None
        if not CODE_PATTERN.match(v):
            raise ValueError("代碼只能用英文字母和數字，3～30 個字")
        return v

    @model_validator(mode="after")
    def _by_kind(self):
        if self.kind == CouponKind.discount:
            if self.discount_type is None or self.discount_value is None:
                raise ValueError("折價券要設定折扣方式與金額")
            if self.discount_type == DiscountType.percent and not (1 <= self.discount_value <= 99):
                raise ValueError("折扣百分比要在 1～99 之間（例如 15＝85 折）")
            self.trial_product_id = None
            self.counts_for_payout = True
            self.issue_on_line_join = False
        else:
            if self.trial_product_id is None:
                raise ValueError("體驗券要選擇送哪個方案")
            self.discount_type = None
            self.discount_value = None
            self.min_amount = 0
            self.product_ids = []
        if self.valid_from and self.valid_until and self.valid_until < self.valid_from:
            raise ValueError("結束日期不能早於開始日期")
        self.product_ids = sorted(set(self.product_ids))
        return self


class CouponOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    kind: CouponKind
    description: str | None
    code: str | None
    discount_type: DiscountType | None
    discount_value: float | None
    min_amount: float
    product_ids: list[int]
    trial_product_id: int | None
    counts_for_payout: bool
    issue_on_line_join: bool
    valid_from: date | None
    valid_until: date | None
    valid_days: int | None
    total_limit: int | None
    per_member_limit: int
    new_member_only: bool
    is_active: bool
    created_by_name: str | None
    created_at: datetime
    # 一行說明（折 300 元／85 折／送「單堂體驗課」1 堂）
    summary: str = ""
    issued_count: int = 0
    used_count: int = 0


class CouponOption(BaseModel):
    """下拉選單用（詢問轉會員時選體驗券）。"""

    id: int
    name: str
    kind: CouponKind
    summary: str


class CouponIssueIn(BaseModel):
    user_ids: list[int] = Field(min_length=1, max_length=500)


class CouponIssueSkip(BaseModel):
    user_id: int
    name: str
    reason: str


class CouponIssueOut(BaseModel):
    issued: int
    skipped: list[CouponIssueSkip]


class MemberCouponOut(BaseModel):
    """會員手上的一張券（會員的「我的優惠券」與後台的發放紀錄共用）。"""

    id: int
    coupon_id: int
    user_id: int
    member_name: str
    name: str
    kind: CouponKind
    description: str | None
    summary: str
    # 可使用／已使用／已過期／已作廢
    status: str
    source: CouponSource
    issued_by_name: str | None
    issued_at: datetime
    expires_on: date | None
    used_at: datetime | None
    purchase_id: int | None
    void_reason: str | None
    # 折價券適用的方案（空＝全部）；體驗券送的方案
    product_ids: list[int]
    trial_product_id: int | None
    min_amount: float


class CouponClaimIn(BaseModel):
    code: str = Field(min_length=1, max_length=30)


class CouponVoidIn(BaseModel):
    reason: str | None = Field(default=None, max_length=100)


class QuoteIn(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1)
    code: str | None = Field(default=None, max_length=30)
    member_coupon_id: int | None = None
    # 後台登錄購買時替哪位會員試算
    user_id: int | None = None


class QuoteOut(BaseModel):
    original: float
    discount: float
    final: float
    coupon_name: str | None
    member_coupon_id: int | None


class UsableCoupon(BaseModel):
    """結帳時「我的優惠券」裡的一張：能不能用在這張訂單、能折多少。"""

    member_coupon: MemberCouponOut
    usable: bool
    discount: float
    final: float
    reason: str | None
