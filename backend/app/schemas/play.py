"""Play module schemas."""

from datetime import datetime
from typing import Any, Literal, Optional

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
    region: str = "meadow"
    avatar_key: str
    play_style: str
    base_rating: int
    rating_range_min: int
    rating_range_max: int
    play_style_params: dict = Field(default_factory=dict)
    is_free: bool
    sort_order: int
    is_unlocked: bool = False
    unlock_story: Optional[str] = None
    affinity: int = 0
    affinity_level: str = "stranger"
    stats: Optional[CharacterStats] = None

    model_config = {"from_attributes": True}


class CharacterDetail(BaseModel):
    """Character detail response."""

    id: str
    slug: str
    name: str
    tier: str
    region: str = "meadow"
    avatar_key: str
    personality: str
    play_style: str
    base_rating: int
    rating_range_min: int
    rating_range_max: int
    engine_depth_min: int
    engine_depth_max: int
    mistake_rate: float
    play_style_params: dict = Field(default_factory=dict)
    unlock_condition: dict = Field(default_factory=dict)
    is_free: bool
    sort_order: int
    is_unlocked: bool = False
    unlock_story: Optional[str] = None
    affinity: int = 0
    affinity_level: str = "stranger"
    stats: Optional[CharacterStats] = None
    dialogues: dict[str, list[str]] = Field(default_factory=dict)

    model_config = {"from_attributes": True}


# ── Unlock Schemas ───────────────────────────────────────────────


class UnlockConditionItem(BaseModel):
    """Single unlock condition status."""

    type: str
    label: str = ""
    required: Any = None
    current: Any = None
    met: bool = False


class CheckUnlockResponse(BaseModel):
    """Response for check-unlock endpoint."""

    character_id: str
    character_name: str
    is_unlocked: bool
    conditions: list[UnlockConditionItem] = Field(default_factory=list)


class UnlockStoryLine(BaseModel):
    """A single line in the unlock story."""

    speaker: str
    text: str
    emotion: Optional[str] = None


class UnlockResponse(BaseModel):
    """Response for unlock endpoint."""

    character_id: str
    character_name: Optional[str] = None
    unlocked: bool
    unlock_story: Optional[list[UnlockStoryLine]] = None
    missing_conditions: Optional[list[UnlockConditionItem]] = None


# ── Adaptive Difficulty Schemas ──────────────────────────────────


class AdaptiveAdjustmentDetail(BaseModel):
    """Adjustment details for adaptive difficulty."""

    rating_offset: int = 0
    depth_adjustment: int = 0
    mistake_rate_adjustment: float = 0.0


class AdaptiveDifficultyResponse(BaseModel):
    """Response for adaptive difficulty status."""

    character_id: str
    character_name: str
    base_rating: int
    effective_rating: int
    difficulty_mode: str = "normal"
    recent_win_rate: float = 0.50
    recent_results: list[str] = Field(default_factory=list)
    adjustment_detail: AdaptiveAdjustmentDetail = Field(default_factory=AdaptiveAdjustmentDetail)


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


class CreateFreeGameRequest(BaseModel):
    """Create a free play or imported game."""

    game_type: Literal["free_play", "imported", "vs_ai_editor"]
    opponent_name: Optional[str] = Field(None, max_length=100, description="Opponent name")
    user_color: str = Field(default="white", description="User's color: white or black")
    time_control: int = Field(default=0, ge=0, le=3600, description="Time control in seconds, 0=unlimited")
    pgn: Optional[str] = Field(None, description="PGN text for imported games")
    initial_fen: Optional[str] = Field(None, description="Starting FEN for non-standard positions")


class SavePositionRequest(BaseModel):
    """Save a board position (setup mode)."""

    fen: str = Field(..., description="FEN string of the position")
    title: Optional[str] = Field(None, max_length=200, description="Position title")
    notes: Optional[str] = Field(None, description="User notes")


class SavePositionResponse(BaseModel):
    """Response after saving a position."""

    game_id: str
    fen: str


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
    game_type: str = "ai_character"
    opponent_name: Optional[str] = None
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
    game_type: str = "ai_character"
    opponent_name: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GameReviewResponse(BaseModel):
    """Game review data response."""

    game_id: str
    review_data: Optional[dict] = None
