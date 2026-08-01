import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    member = "member"


class User(Base):
    """
    帳號表：管理員與所有會員（學員／場租教練）共用。
    「身份（學員／場租教練）」不落欄位，由 coaches 是否存在該 user_id 綁定紀錄衍生判斷。
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.member, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_blacklisted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    coach_profile: Mapped["Coach | None"] = relationship(
        "Coach", back_populates="user", uselist=False, foreign_keys="Coach.user_id"
    )
