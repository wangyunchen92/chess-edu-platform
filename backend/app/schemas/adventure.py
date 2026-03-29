"""Adventure module schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Map & Region Schemas ─────────────────────────────────────────


class ChallengeItem(BaseModel):
    """A single challenge within a region."""

    id: str
    name: str
    type: str
    description: str
    reward_xp: int
    opponent_id: Optional[str] = None
    is_completed: bool = False


class RegionItem(BaseModel):
    """Region item for map listing."""

    id: str
    name: str
    description: str
    rating_range: list[int]
    icon: str
    unlock_condition: dict
    is_unlocked: bool = False
    challenges_total: int = 0
    challenges_completed: int = 0


class RegionDetail(BaseModel):
    """Region detail with challenges."""

    id: str
    name: str
    description: str
    rating_range: list[int]
    icon: str
    unlock_condition: dict
    is_unlocked: bool = False
    challenges: list[ChallengeItem] = []


class AdventureMapResponse(BaseModel):
    """Adventure map response."""

    regions: list[RegionItem]
    current_rating: int = 300
    current_region: str = "meadow"


# ── Challenge Schemas ────────────────────────────────────────────


class StartChallengeRequest(BaseModel):
    """Start challenge request (body can be empty, id comes from path)."""
    pass


class ChallengeRecord(BaseModel):
    """Challenge record response."""

    id: str
    user_id: str
    challenge_id: str
    challenge_type: str
    target_rank: str
    status: str
    game_id: Optional[str] = None
    quiz_score: Optional[int] = None
    attempt_count: int = 1
    passed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CompleteChallengeRequest(BaseModel):
    """Complete challenge request."""

    result: str = Field(..., description="Challenge result: pass or fail")
    game_id: Optional[str] = Field(None, description="Associated game ID (for battle type)")
    quiz_answers: Optional[dict] = Field(None, description="Quiz answers (for quiz type)")
    quiz_score: Optional[int] = Field(None, description="Quiz score (for quiz type)")
