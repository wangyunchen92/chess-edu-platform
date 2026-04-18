"""User and UserProfile ORM models."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.achievement import UserAchievement
    from app.models.adaptive import AdaptiveDifficultyConfig
    from app.models.adventure import PromotionChallenge
    from app.models.character import UserCharacterRelation
    from app.models.course import ExerciseAttempt, LessonProgress
    from app.models.diagnosis import UserWeaknessProfile, WeaknessRecommendation
    from app.models.game import Game
    from app.models.gamification import RatingHistory, UserRating, UserStreak
    from app.models.membership import UserDailyQuota
    from app.models.notification import Notification
    from app.models.puzzle import PuzzleAttempt
    from app.models.train import DailyTrainPlan, DailyTrainRecord


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="student")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    membership_tier: Mapped[str] = mapped_column(
        String(20), nullable=False, default="free"
    )
    membership_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    login_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    referral_code: Mapped[Optional[str]] = mapped_column(
        String(6), unique=True, nullable=True
    )
    referred_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )

    # Relationships
    profile: Mapped[Optional["UserProfile"]] = relationship(
        "UserProfile", back_populates="user", uselist=False, lazy="selectin"
    )
    rating: Mapped[Optional["UserRating"]] = relationship(
        "UserRating", back_populates="user", uselist=False, lazy="selectin"
    )
    streak: Mapped[Optional["UserStreak"]] = relationship(
        "UserStreak", back_populates="user", uselist=False, lazy="selectin"
    )
    games: Mapped[list["Game"]] = relationship("Game", back_populates="user", lazy="noload")
    puzzle_attempts: Mapped[list["PuzzleAttempt"]] = relationship(
        "PuzzleAttempt", back_populates="user", lazy="noload"
    )
    lesson_progresses: Mapped[list["LessonProgress"]] = relationship(
        "LessonProgress", back_populates="user", lazy="noload"
    )
    exercise_attempts: Mapped[list["ExerciseAttempt"]] = relationship(
        "ExerciseAttempt", back_populates="user", lazy="noload"
    )
    daily_train_plans: Mapped[list["DailyTrainPlan"]] = relationship(
        "DailyTrainPlan", back_populates="user", lazy="noload"
    )
    daily_train_records: Mapped[list["DailyTrainRecord"]] = relationship(
        "DailyTrainRecord", back_populates="user", lazy="noload"
    )
    user_achievements: Mapped[list["UserAchievement"]] = relationship(
        "UserAchievement", back_populates="user", lazy="noload"
    )
    character_relations: Mapped[list["UserCharacterRelation"]] = relationship(
        "UserCharacterRelation", back_populates="user", lazy="noload"
    )
    rating_histories: Mapped[list["RatingHistory"]] = relationship(
        "RatingHistory", back_populates="user", lazy="noload"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", back_populates="user", lazy="noload"
    )
    daily_quotas: Mapped[list["UserDailyQuota"]] = relationship(
        "UserDailyQuota", back_populates="user", lazy="noload"
    )
    promotion_challenges: Mapped[list["PromotionChallenge"]] = relationship(
        "PromotionChallenge", back_populates="user", lazy="noload"
    )
    weakness_profile: Mapped[Optional["UserWeaknessProfile"]] = relationship(
        "UserWeaknessProfile", back_populates="user", uselist=False, lazy="noload"
    )
    weakness_recommendations: Mapped[list["WeaknessRecommendation"]] = relationship(
        "WeaknessRecommendation", back_populates="user", lazy="noload"
    )
    adaptive_configs: Mapped[list["AdaptiveDifficultyConfig"]] = relationship(
        "AdaptiveDifficultyConfig", back_populates="user", lazy="noload"
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )
    display_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    birth_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    chess_experience: Mapped[Optional[str]] = mapped_column(
        String(20), default="none", nullable=True
    )
    assessment_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    initial_rating: Mapped[Optional[int]] = mapped_column(Integer, default=300, nullable=True)
    preferred_time: Mapped[Optional[int]] = mapped_column(Integer, default=15, nullable=True)
    notification_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    daily_remind_time: Mapped[Optional[str]] = mapped_column(Time, default="18:00", nullable=True)
    theme: Mapped[Optional[str]] = mapped_column(String(20), default="default", nullable=True)
    sound_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="profile")
