"""Character, CharacterDialogue, and UserCharacterRelation ORM models."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.game import Game
    from app.models.user import User


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    slug: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(20), nullable=False)
    tier: Mapped[str] = mapped_column(String(20), nullable=False)
    avatar_key: Mapped[str] = mapped_column(String(50), nullable=False)
    personality: Mapped[str] = mapped_column(Text, nullable=False)
    play_style: Mapped[str] = mapped_column(String(20), nullable=False)
    base_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    rating_range_min: Mapped[int] = mapped_column(Integer, nullable=False)
    rating_range_max: Mapped[int] = mapped_column(Integer, nullable=False)
    engine_depth_min: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    engine_depth_max: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    mistake_rate: Mapped[float] = mapped_column(
        Numeric(3, 2), nullable=False, default=0.30
    )
    unlock_condition: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_free: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    dialogues: Mapped[list["CharacterDialogue"]] = relationship(
        "CharacterDialogue", back_populates="character", lazy="noload", cascade="all, delete-orphan"
    )
    games: Mapped[list["Game"]] = relationship(
        "Game", back_populates="character", lazy="noload"
    )
    user_relations: Mapped[list["UserCharacterRelation"]] = relationship(
        "UserCharacterRelation", back_populates="character", lazy="noload"
    )


class CharacterDialogue(Base):
    __tablename__ = "character_dialogues"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    character_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    scene: Mapped[str] = mapped_column(String(30), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    emotion: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    character: Mapped["Character"] = relationship("Character", back_populates="dialogues")


class UserCharacterRelation(Base):
    __tablename__ = "user_character_relations"
    __table_args__ = (
        UniqueConstraint("user_id", "character_id", name="uq_user_char_rel_user_char"),
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
    is_unlocked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    unlocked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    affinity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    games_played: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    games_won: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    games_lost: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    games_drawn: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="character_relations")
    character: Mapped["Character"] = relationship("Character", back_populates="user_relations")
