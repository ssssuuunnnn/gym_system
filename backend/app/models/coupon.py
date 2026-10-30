import enum
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.tenant import TenantMixin


class CouponKind(str, enum.Enum):
    """優惠券類型（ADR 0010）。資料庫存成員名稱。"""

    trial = "體驗券"
    discount = "折價券"


class DiscountType(str, enum.Enum):
    amount = "折抵金額"
    percent = "折扣"


class MemberCouponStatus(str, enum.Enum):
    """會員手上的券。「已過期」不存，依 expires_on 即時判斷。"""

    available = "可使用"
    used = "已使用"
    void = "已作廢"


class CouponSource(str, enum.Enum):
    code = "輸入代碼"
    staff = "櫃台發放"
    line_join = "LINE 加入"
    convert = "轉為會員"


class Coupon(TenantMixin, Base):
    """
    優惠券設定（ADR 0010、R43–R47）。
    - 折價券：購買方案時折抵金額（折固定金額或打折），可限最低消費與適用方案。
    - 體驗券：使用時送一個方案的堂數（建立金額 0、已付款的購買紀錄），可選是否計教練鐘點。
    有代碼＝公開代碼券，會員輸入代碼領取／使用；沒有代碼＝只能由後台發給指定會員。
    不刪除，只停用：停用後不能再發放或領取，已發出的仍可在效期內使用。
    """

    __tablename__ = "coupons"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_coupons_tenant_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    kind: Mapped[CouponKind] = mapped_column(Enum(CouponKind), nullable=False)
    # 給會員看的說明（例如「限新會員、平日晚上可用」）
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # 公開代碼（大寫英數），沒有代碼就只能由後台發放
    code: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # 折價券
    discount_type: Mapped[DiscountType | None] = mapped_column(Enum(DiscountType), nullable=True)
    # 折抵金額（元）或折扣百分比（15＝85 折）
    discount_value: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    min_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0, server_default="0")
    # 適用方案；空＝全部方案都可用
    product_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")

    # 體驗券：送這個方案（數量 1）的堂數；方案可以是不上架販售的「體驗課」
    trial_product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    # 用體驗券上的課是否計教練鐘點
    counts_for_payout: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    # LINE 新加入會員時自動發放
    issue_on_line_join: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    # 發出後幾天內有效（和 valid_until 取較早者）
    valid_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 總共可以發出幾張；None＝不限
    total_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    per_member_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    # 只限從沒有付費購買紀錄的會員
    new_member_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    created_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    trial_product: Mapped["Product | None"] = relationship("Product", foreign_keys=[trial_product_id])


class MemberCoupon(TenantMixin, Base):
    """會員手上的一張券：後台發放、LINE 加入、轉為會員時建立，或會員輸入公開代碼時領取。"""

    __tablename__ = "member_coupons"

    id: Mapped[int] = mapped_column(primary_key=True)
    coupon_id: Mapped[int] = mapped_column(ForeignKey("coupons.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[MemberCouponStatus] = mapped_column(
        Enum(MemberCouponStatus), nullable=False, default=MemberCouponStatus.available
    )
    source: Mapped[CouponSource] = mapped_column(Enum(CouponSource), nullable=False)
    issued_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    # 最後可使用的日期（工作室當地日期）；None＝不限
    expires_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # 用在哪一筆購買（折價券＝那筆訂單；體驗券＝送堂數的那筆購買紀錄）
    purchase_id: Mapped[int | None] = mapped_column(ForeignKey("purchases.id", ondelete="SET NULL"), nullable=True)
    voided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    void_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)

    coupon: Mapped[Coupon] = relationship(Coupon)
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
