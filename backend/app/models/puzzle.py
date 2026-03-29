"""Puzzle, DailyPuzzle, and PuzzleAttempt ORM models."""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Puzzle(Base):
    __tablename__ = "puzzles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    puzzle_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    fen: Mapped[str] = mapped_column(String(100), nullable=False)
    solution_moves: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty_level: Mapped[int] = mapped_column(Integer, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    themes: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    hint_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    side_to_move: Mapped[str] = mapped_column(String(5), nullable=False)
    move_count: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_daily_pool: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_challenge: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    challenge_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    daily_puzzles: Mapped[list["DailyPuzzle"]] = relationship(
        "DailyPuzzle", back_populates="puzzle", lazy="noload"
    )
    attempts: Mapped[list["PuzzleAttempt"]] = relationship(
        "PuzzleAttempt", back_populates="puzzle", lazy="noload"
    )


class DailyPuzzle(Base):
    __tablename__ = "daily_puzzles"
    __table_args__ = (
        UniqueConstraint("puzzle_date", "sort_order", name="uq_daily_puzzles_date_order"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    puzzle_date: Mapped[date] = mapped_column(Date, nullable=False)
    puzzle_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("puzzles.id"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    puzzle: Mapped["Puzzle"] = relationship("Puzzle", back_populates="daily_puzzles")


class PuzzleAttempt(Base):
    __tablename__ = "puzzle_attempts"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    puzzle_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("puzzles.id"), nullable=False
    )
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    user_moves: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    time_spent_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    hint_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rating_before: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rating_after: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rating_change: Mapped[Optional[int]] = mapped_column(Integer, default=0, nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="challenge")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="puzzle_attempts")
    puzzle: Mapped["Puzzle"] = relationship("Puzzle", back_populates="attempts")
