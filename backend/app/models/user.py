import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.tenant import TenantMixin


UNUSABLE_PASSWORD = "!"


class UserRole(str, enum.Enum):
    admin = "admin"
    member = "member"


class User(TenantMixin, Base):
    """
    帳號表：管理員與所有會員（學員／場租教練）共用。
    「身份（學員／場租教練）」不落欄位，由 coaches 是否存在該 user_id 綁定紀錄衍生判斷。
    """

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "username", name="uq_users_tenant_username"),
        # 同一家健身房裡，一個 LINE 帳號只能綁一個會員（見 ADR 0005）
        UniqueConstraint("tenant_id", "line_user_id", name="uq_users_tenant_line_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # 帳號在同一租戶內唯一（同一人在不同健身房是不同帳號，見 ADR 0001）
    username: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    # 只用 LINE 加入的會員沒有密碼：存 UNUSABLE_PASSWORD 開頭的值，verify_password 一律失敗；
    # 管理員在會員詳情「重設密碼」後即可用帳號密碼登入網頁
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.member, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_blacklisted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # 由管理員在「會員詳情」重設密碼時勾選：會員下次登入須先自行修改密碼才能使用其他功能
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # 會員資料：在 LINE 加入會員時填寫，管理員可在會員詳情修改
    display_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # 健身房 LINE 官方帳號（同一 Provider）的使用者 ID
    line_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    line_display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    line_linked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # 會員自己可關閉從健身房官方帳號收到的通知（預約結果、上課提醒、收款）
    line_notify: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    # 同意接收優惠與活動訊息（行銷）的時間；NULL＝未同意。和上面的服務通知分開，預設不同意，會員可隨時取消（R31）
    marketing_consent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    @property
    def has_password(self) -> bool:
        return not self.password_hash.startswith(UNUSABLE_PASSWORD)

    @property
    def marketing_consent(self) -> bool:
        return self.marketing_consent_at is not None

    @property
    def line_linked(self) -> bool:
        return self.line_user_id is not None

    coach_profile: Mapped["Coach | None"] = relationship(
        "Coach", back_populates="user", uselist=False, foreign_keys="Coach.user_id"
    )
