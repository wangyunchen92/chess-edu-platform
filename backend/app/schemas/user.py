"""User module schemas."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserProfileResponse(BaseModel):
    """User profile detail."""

    display_name: Optional[str] = None
    birth_year: Optional[int] = None
    chess_experience: Optional[str] = None
    assessment_done: bool = False
    initial_rating: Optional[int] = None
    preferred_time: Optional[int] = None
    notification_enabled: bool = True
    daily_remind_time: Optional[str] = None
    theme: Optional[str] = None
    sound_enabled: bool = True

    model_config = {"from_attributes": True}


class UserRatingResponse(BaseModel):
    """User rating info."""

    game_rating: int = 300
    puzzle_rating: int = 300
    rank_title: str = "apprentice_1"
    rank_tier: int = 1
    rank_region: str = "meadow"
    xp_total: int = 0
    xp_today: int = 0
    coins: int = 0

    model_config = {"from_attributes": True}


class UserStreakResponse(BaseModel):
    """User streak info."""

    login_streak: int = 0
    login_streak_max: int = 0
    train_streak: int = 0
    train_streak_max: int = 0
    last_login_date: Optional[date] = None
    last_train_date: Optional[date] = None
    total_train_days: int = 0

    model_config = {"from_attributes": True}


class UserFullResponse(BaseModel):
    """Full user info including profile, rating, and streak."""

    id: str
    username: str
    nickname: str
    avatar_url: Optional[str] = None
    role: str
    status: str
    membership_tier: str
    membership_expires_at: Optional[datetime] = None
    created_at: datetime
    last_login_at: Optional[datetime] = None
    login_count: int = 0
    profile: Optional[UserProfileResponse] = None
    rating: Optional[UserRatingResponse] = None
    streak: Optional[UserStreakResponse] = None

    model_config = {"from_attributes": True}


class UpdateUserRequest(BaseModel):
    """Update user basic info."""

    nickname: Optional[str] = Field(None, min_length=1, max_length=50)
    avatar_url: Optional[str] = Field(None, max_length=500)


class UpdateSettingsRequest(BaseModel):
    """Update user settings."""

    theme: Optional[str] = Field(None, max_length=20)
    sound_enabled: Optional[bool] = None
    notification_enabled: Optional[bool] = None
    daily_remind_time: Optional[str] = Field(None, max_length=10)
    preferred_time: Optional[int] = Field(None, ge=1, le=60)


# ── Profile Stats Schemas (B3-5) ────────────────────────────────


class GameStats(BaseModel):
    """Aggregated game statistics."""

    total_games: int = 0
    wins: int = 0
    losses: int = 0
    draws: int = 0
    win_rate: float = 0.0


class PuzzleStats(BaseModel):
    """Aggregated puzzle statistics."""

    total_solved: int = 0
    accuracy: float = 0.0
    puzzle_rating: int = 300


class LearningStats(BaseModel):
    """Aggregated learning statistics."""

    completed_lessons: int = 0
    total_lessons: int = 0


class AchievementBrief(BaseModel):
    """Brief achievement info for profile display."""

    id: str
    name: str
    icon_key: str
    achieved_at: datetime


class ProfileStatsResponse(BaseModel):
    """Complete profile statistics aggregation."""

    game_stats: GameStats
    puzzle_stats: PuzzleStats
    learning_stats: LearningStats
    recent_achievements: list[AchievementBrief] = []
