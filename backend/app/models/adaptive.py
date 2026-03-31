"""AdaptiveDifficultyConfig ORM model."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.character import Character
    from app.models.user import User


class AdaptiveDifficultyConfig(Base):
    __tablename__ = "adaptive_difficulty_configs"
    __table_args__ = (
        UniqueConstraint("user_id", "character_id", name="uq_adaptive_config_user_char"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    character_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )

    # Recent game results
    recent_results: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    recent_win_rate: Mapped[float] = mapped_column(
        Numeric(3, 2), nullable=False, default=0.50
    )

    # Adjustment values
    current_rating_offset: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_depth_adjustment: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_mistake_rate_adjustment: Mapped[float] = mapped_column(
        Numeric(3, 2), nullable=False, default=0.00
    )

    adjustment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    last_adjusted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="adaptive_configs")
    character: Mapped["Character"] = relationship("Character", lazy="noload")
