"""Game and GameMove ORM models."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.character import Character
    from app.models.user import User


class Game(Base):
    __tablename__ = "games"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    character_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("characters.id"), nullable=False
    )
    user_color: Mapped[str] = mapped_column(String(5), nullable=False, default="white")
    time_control: Mapped[int] = mapped_column(Integer, nullable=False, default=600)
    time_increment: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="playing")
    result: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    result_reason: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    pgn: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    final_fen: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    total_moves: Mapped[Optional[int]] = mapped_column(Integer, default=0, nullable=True)
    user_rating_before: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    user_rating_after: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rating_change: Mapped[Optional[int]] = mapped_column(Integer, default=0, nullable=True)
    ai_rating_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    hints_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    review_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="games")
    character: Mapped["Character"] = relationship("Character", back_populates="games")
    moves: Mapped[list["GameMove"]] = relationship(
        "GameMove", back_populates="game", lazy="noload", cascade="all, delete-orphan"
    )


class GameMove(Base):
    __tablename__ = "game_moves"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    game_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("games.id", ondelete="CASCADE"), nullable=False
    )
    move_number: Mapped[int] = mapped_column(Integer, nullable=False)
    side: Mapped[str] = mapped_column(String(5), nullable=False)
    move_san: Mapped[str] = mapped_column(String(10), nullable=False)
    move_uci: Mapped[str] = mapped_column(String(10), nullable=False)
    fen_after: Mapped[str] = mapped_column(String(100), nullable=False)
    eval_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_best_move: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_mistake: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True)
    is_blunder: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True)
    is_key_moment: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True)
    time_spent_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    game: Mapped["Game"] = relationship("Game", back_populates="moves")
