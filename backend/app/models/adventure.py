"""PromotionChallenge ORM model."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.game import Game
    from app.models.user import User


class PromotionChallenge(Base):
    __tablename__ = "promotion_challenges"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    challenge_type: Mapped[str] = mapped_column(String(30), nullable=False)
    target_rank: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    game_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("games.id"), nullable=True
    )
    quiz_answers: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    quiz_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    passed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="promotion_challenges")
    game: Mapped[Optional["Game"]] = relationship("Game", lazy="noload")
