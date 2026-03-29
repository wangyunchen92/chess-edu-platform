"""Achievement and UserAchievement ORM models."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon_key: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    condition_type: Mapped[str] = mapped_column(String(30), nullable=False)
    condition_value: Mapped[int] = mapped_column(Integer, nullable=False)
    xp_reward: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    coin_reward: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    rarity: Mapped[str] = mapped_column(String(10), nullable=False, default="common")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user_achievements: Mapped[list["UserAchievement"]] = relationship(
        "UserAchievement", back_populates="achievement", lazy="noload"
    )


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", name="uq_user_achievements_user_ach"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    achievement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("achievements.id"), nullable=False
    )
    achieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    is_displayed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="user_achievements")
    achievement: Mapped["Achievement"] = relationship("Achievement", back_populates="user_achievements")
