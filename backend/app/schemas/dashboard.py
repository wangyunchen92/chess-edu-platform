"""Dashboard module schemas."""

from typing import Optional

from pydantic import BaseModel


class DashboardTrainProgress(BaseModel):
    """Today's training progress for dashboard."""

    total_items: int
    completed_items: int
    is_completed: bool


class DashboardRating(BaseModel):
    """Rating info for dashboard."""

    game_rating: int
    puzzle_rating: int
    rank_title: str
    rank_region: str


class DashboardRecentGame(BaseModel):
    """Recent game summary."""

    game_id: str
    character_name: Optional[str] = None
    result: Optional[str] = None
    rating_change: Optional[int] = None


class DashboardResponse(BaseModel):
    """Dashboard aggregated data."""

    train_progress: Optional[DashboardTrainProgress] = None
    rating: DashboardRating
    xp_today: int
    xp_total: int
    level: int
    xp_to_next_level: int = 0
    streak: int
    recent_games: list[DashboardRecentGame] = []
    daily_puzzles_remaining: int = 0
    unread_notifications: int = 0
