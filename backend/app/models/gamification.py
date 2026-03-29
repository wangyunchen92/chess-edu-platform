"""UserRating, RatingHistory, and UserStreak ORM models."""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class UserRating(Base):
    __tablename__ = "user_ratings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )
    game_rating: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    puzzle_rating: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    rank_title: Mapped[str] = mapped_column(String(20), nullable=False, default="apprentice_1")
    rank_tier: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    rank_region: Mapped[str] = mapped_column(String(30), nullable=False, default="meadow")
    xp_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    xp_today: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    coins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="rating")


class RatingHistory(Base):
    __tablename__ = "rating_histories"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    rating_type: Mapped[str] = mapped_column(String(10), nullable=False)
    old_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    new_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    change_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="rating_histories")


class UserStreak(Base):
    __tablename__ = "user_streaks"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )
    login_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    login_streak_max: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    train_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    train_streak_max: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_login_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_train_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    total_train_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="streak")
