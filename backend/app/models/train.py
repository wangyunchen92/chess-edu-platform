"""DailyTrainPlan and DailyTrainRecord ORM models."""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class DailyTrainPlan(Base):
    __tablename__ = "daily_train_plans"
    __table_args__ = (
        UniqueConstraint("user_id", "plan_date", name="uq_daily_train_plans_user_date"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plan_date: Mapped[date] = mapped_column(Date, nullable=False)
    template_type: Mapped[str] = mapped_column(String(20), nullable=False, default="standard")
    items: Mapped[dict] = mapped_column(JSON, nullable=False)
    total_items: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    completed_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    total_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=25)
    actual_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    xp_earned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="daily_train_plans")
    records: Mapped[list["DailyTrainRecord"]] = relationship(
        "DailyTrainRecord", back_populates="plan", lazy="noload", cascade="all, delete-orphan"
    )


class DailyTrainRecord(Base):
    __tablename__ = "daily_train_records"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("daily_train_plans.id", ondelete="CASCADE"), nullable=False
    )
    item_index: Mapped[int] = mapped_column(Integer, nullable=False)
    item_type: Mapped[str] = mapped_column(String(20), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    result_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="daily_train_records")
    plan: Mapped["DailyTrainPlan"] = relationship("DailyTrainPlan", back_populates="records")
