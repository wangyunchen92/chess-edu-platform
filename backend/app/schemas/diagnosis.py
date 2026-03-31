"""Diagnosis (weakness profile) module schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Profile ─────────────────────────────────────────────────────


class ThemeScoreItem(BaseModel):
    """Score data for a single puzzle theme."""

    score: int = 0
    correct: int = 0
    total: int = 0


class DimensionScores(BaseModel):
    """Scores across the five main dimensions."""

    opening: int = 50
    middlegame_tactics: int = 50
    middlegame_strategy: int = 50
    endgame: int = 50
    time_management: int = 50


class WeaknessProfileResponse(BaseModel):
    """GET /diagnosis/profile response."""

    user_id: Optional[str] = None
    confidence: str = "low"
    scores: Optional[DimensionScores] = None
    theme_scores: Optional[dict[str, ThemeScoreItem]] = None
    weakest_dimensions: list[str] = Field(default_factory=list)
    games_analyzed: int = 0
    puzzles_analyzed: int = 0
    last_analyzed_at: Optional[datetime] = None
    # When data insufficient
    min_games_required: int = 10
    min_puzzles_required: int = 30
    message: Optional[str] = None


# ── Analyze ─────────────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    """POST /diagnosis/analyze request."""

    force: bool = False


class AnalyzeChangeItem(BaseModel):
    """A single dimension change after analysis."""

    dimension: str
    old_score: int
    new_score: int
    trend: str  # "up" / "down" / "stable"


class AnalyzeResponse(BaseModel):
    """POST /diagnosis/analyze response."""

    analyzed: bool = False
    games_analyzed: int = 0
    puzzles_analyzed: int = 0
    changes: list[AnalyzeChangeItem] = Field(default_factory=list)


# ── Recommendations ─────────────────────────────────────────────


class RecommendationItem(BaseModel):
    """A single weakness recommendation."""

    id: str
    weakness_dimension: str
    recommendation_type: str
    target_id: Optional[str] = None
    target_label: str
    reason: Optional[str] = None
    priority: int = 0
    status: str = "active"


class UpdateRecommendationRequest(BaseModel):
    """PATCH /diagnosis/recommendations/{id} request."""

    status: str = Field(..., description="New status: completed / dismissed")


class UpdateRecommendationResponse(BaseModel):
    """PATCH /diagnosis/recommendations/{id} response."""

    id: str
    status: str


# ── Summary (Dashboard) ────────────────────────────────────────


class PrimaryWeakness(BaseModel):
    """Primary weakness for dashboard summary."""

    dimension: str
    label: str
    score: int
    suggestion: str


class DiagnosisSummaryResponse(BaseModel):
    """GET /diagnosis/summary response."""

    has_diagnosis: bool = False
    confidence: Optional[str] = None
    primary_weakness: Optional[PrimaryWeakness] = None
    active_recommendations_count: int = 0
