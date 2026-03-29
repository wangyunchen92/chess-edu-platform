"""Gamification module schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AchievementItem(BaseModel):
    """Achievement with user status."""

    id: str
    slug: str
    name: str
    description: str
    icon_key: str
    category: str
    condition_type: str
    condition_value: int
    xp_reward: int
    coin_reward: int
    rarity: str
    achieved: bool = False
    achieved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AchievementsResponse(BaseModel):
    """Achievements list."""

    achievements: list[AchievementItem]
    unlocked_count: int
    total_count: int


class XPResponse(BaseModel):
    """XP information."""

    xp_total: int
    xp_today: int
    level: int
    xp_to_next_level: int
    coins: int


class RankResponse(BaseModel):
    """Rank information."""

    game_rating: int
    puzzle_rating: int
    rank_title: str
    rank_tier: int
    rank_region: str
    history: list[dict] = []


class CheckAchievementsResponse(BaseModel):
    """Newly unlocked achievements."""

    newly_unlocked: list[AchievementItem]
    xp_awarded: int
    coins_awarded: int
