"""Play module schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Character Schemas ─────────────────────────────────────────────


class CharacterStats(BaseModel):
    """User's stats against a specific character."""

    games_played: int = 0
    games_won: int = 0
    games_lost: int = 0
    games_drawn: int = 0


class CharacterListItem(BaseModel):
    """Character item for list endpoint."""

    id: str
    slug: str
    name: str
    tier: str
    avatar_key: str
    play_style: str
    base_rating: int
    rating_range_min: int
    rating_range_max: int
    is_free: bool
    sort_order: int
    is_unlocked: bool = False
    stats: Optional[CharacterStats] = None

    model_config = {"from_attributes": True}


class CharacterDetail(BaseModel):
    """Character detail response."""

    id: str
    slug: str
    name: str
    tier: str
    avatar_key: str
    personality: str
    play_style: str
    base_rating: int
    rating_range_min: int
    rating_range_max: int
    engine_depth_min: int
    engine_depth_max: int
    mistake_rate: float
    is_free: bool
    sort_order: int
    is_unlocked: bool = False
    stats: Optional[CharacterStats] = None

    model_config = {"from_attributes": True}


# ── Game Schemas ──────────────────────────────────────────────────


class CreateGameRequest(BaseModel):
    """Create game request payload."""

    character_id: str = Field(..., description="Character ID to play against")
    time_control: int = Field(default=600, ge=60, le=3600, description="Time control in seconds")


class CreateGameResponse(BaseModel):
    """Create game response payload."""

    game_id: str


class CompleteGameRequest(BaseModel):
    """Complete game request payload."""

    result: str = Field(..., description="Game result: win, loss, draw")
    pgn: Optional[str] = Field(None, description="PGN notation of the game")
    moves_count: Optional[int] = Field(None, ge=0, description="Total number of moves")
    user_color: str = Field(default="white", description="User's color: white or black")
    final_fen: Optional[str] = Field(None, description="Final board FEN position")


class GameListItem(BaseModel):
    """Game item for list endpoint."""

    id: str
    character_id: str
    character_name: Optional[str] = None
    character_avatar_key: Optional[str] = None
    user_color: str
    time_control: int
    status: str
    result: Optional[str] = None
    total_moves: Optional[int] = None
    rating_change: Optional[int] = None
    user_rating_before: Optional[int] = None
    user_rating_after: Optional[int] = None
    started_at: datetime
    ended_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class GameDetail(BaseModel):
    """Game detail response."""

    id: str
    user_id: str
    character_id: str
    character_name: Optional[str] = None
    character_avatar_key: Optional[str] = None
    user_color: str
    time_control: int
    time_increment: int
    status: str
    result: Optional[str] = None
    result_reason: Optional[str] = None
    pgn: Optional[str] = None
    final_fen: Optional[str] = None
    total_moves: Optional[int] = None
    user_rating_before: Optional[int] = None
    user_rating_after: Optional[int] = None
    rating_change: Optional[int] = None
    ai_rating_used: Optional[int] = None
    hints_used: int = 0
    review_data: Optional[dict] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GameReviewResponse(BaseModel):
    """Game review data response."""

    game_id: str
    review_data: Optional[dict] = None
