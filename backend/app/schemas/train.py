"""Train module schemas."""

from datetime import date
from typing import Optional

from pydantic import BaseModel


class TrainPlanItem(BaseModel):
    """A single training plan item."""

    index: int
    item_type: str
    title: str
    description: str
    estimated_minutes: int
    is_completed: bool = False
    link: Optional[str] = None


class TodayPlanResponse(BaseModel):
    """Today's training plan."""

    plan_id: str
    plan_date: date
    template_type: str
    items: list[TrainPlanItem]
    total_items: int
    completed_items: int
    is_completed: bool
    total_minutes: int
    xp_earned: int


class CompletePlanItemResponse(BaseModel):
    """Result after completing a plan item."""

    item_index: int
    is_completed: bool
    plan_completed: bool
    xp_earned: int


class DailyTrainSummary(BaseModel):
    """Summary of training for a single day."""

    date: str
    completed_items: int
    total_items: int
    is_completed: bool


class TrainStatsResponse(BaseModel):
    """Training statistics."""

    train_streak: int
    train_streak_max: int
    total_train_days: int
    this_week_completed: int
    this_week_total: int = 7
    today_completed: bool
    recent_days: list[DailyTrainSummary] = []


class StreakResponse(BaseModel):
    """Streak info."""

    login_streak: int
    login_streak_max: int
    train_streak: int
    train_streak_max: int
    total_train_days: int
    last_train_date: Optional[date] = None
