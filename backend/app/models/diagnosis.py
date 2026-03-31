"""UserWeaknessProfile and WeaknessRecommendation ORM models."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class UserWeaknessProfile(Base):
    __tablename__ = "user_weakness_profiles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )

    # Dimension scores (0-100, higher = stronger)
    opening_score: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    middlegame_tactics_score: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    middlegame_strategy_score: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    endgame_score: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    time_management_score: Mapped[int] = mapped_column(Integer, nullable=False, default=50)

    # Theme-level scores from puzzle attempts
    theme_scores: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Stats basis
    games_analyzed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    puzzles_analyzed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Cached weakest dimensions
    weakest_dimensions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Confidence level
    confidence: Mapped[str] = mapped_column(String(10), nullable=False, default="low")

    last_analyzed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="weakness_profile")


class WeaknessRecommendation(Base):
    __tablename__ = "weakness_recommendations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    weakness_dimension: Mapped[str] = mapped_column(String(30), nullable=False)
    recommendation_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    target_label: Mapped[str] = mapped_column(String(100), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="weakness_recommendations")
