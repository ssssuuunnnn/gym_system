import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.tenant import TenantMixin


class UserRole(str, enum.Enum):
    admin = "admin"
    member = "member"


class User(TenantMixin, Base):
    """
    帳號表：管理員與所有會員（學員／場租教練）共用。
    「身份（學員／場租教練）」不落欄位，由 coaches 是否存在該 user_id 綁定紀錄衍生判斷。
    """

    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("tenant_id", "username", name="uq_users_tenant_username"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # 帳號在同一租戶內唯一（同一人在不同健身房是不同帳號，見 ADR 0001）
    username: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.member, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_blacklisted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # 由管理員在「會員詳情」重設密碼時勾選：會員下次登入須先自行修改密碼才能使用其他功能
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    coach_profile: Mapped["Coach | None"] = relationship(
        "Coach", back_populates="user", uselist=False, foreign_keys="Coach.user_id"
    )
