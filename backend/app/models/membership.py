"""MembershipPlan and UserDailyQuota ORM models."""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class MembershipPlan(Base):
    __tablename__ = "membership_plans"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    slug: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    tier: Mapped[str] = mapped_column(String(20), nullable=False)
    billing_period: Mapped[str] = mapped_column(String(10), nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    original_price_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    features: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class UserDailyQuota(Base):
    __tablename__ = "user_daily_quotas"
    __table_args__ = (
        UniqueConstraint("user_id", "quota_date", name="uq_user_daily_quotas_user_date"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    quota_date: Mapped[date] = mapped_column(Date, nullable=False)
    games_played: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    puzzles_solved: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ai_qa_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    xp_earned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="daily_quotas")
