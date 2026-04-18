"""HonorRecord ORM model."""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer, String, Text,
    UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class HonorRecord(Base):
    __tablename__ = "honor_records"
    __table_args__ = (
        UniqueConstraint("user_id", "milestone_key", name="uq_honor_user_milestone"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # "competition" or "milestone"
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rank: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    competition_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    competition_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    milestone_key: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    milestone_value: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")
