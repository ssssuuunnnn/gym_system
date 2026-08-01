from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    coach_id: Mapped[int] = mapped_column(ForeignKey("coaches.id"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    start_hour: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    max_capacity: Mapped[int] = mapped_column(SmallInteger, nullable=False, comment="人數上限 3-8")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    coach: Mapped["Coach"] = relationship("Coach")
