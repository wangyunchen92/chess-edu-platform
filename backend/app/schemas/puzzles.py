"""Puzzle module schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PuzzleItem(BaseModel):
    """A single puzzle."""

    id: str
    puzzle_code: str
    fen: str
    solution_moves: str
    difficulty_level: int
    rating: int
    themes: Optional[str] = None
    description: Optional[str] = None
    hint_text: Optional[str] = None
    explanation: Optional[str] = None
    side_to_move: str
    move_count: int

    model_config = {"from_attributes": True}


class PuzzleAttemptRequest(BaseModel):
    """Submit puzzle attempt."""

    user_moves: str = Field(..., description="User's move sequence")
    is_correct: bool = Field(..., description="Whether the answer is correct")
    time_spent_ms: Optional[int] = Field(None, ge=0, description="Time spent in ms")
    hint_used: bool = Field(default=False)
    source: str = Field(default="challenge", description="daily or challenge")


class PuzzleAttemptResponse(BaseModel):
    """Result after submitting attempt."""

    is_correct: bool
    puzzle_rating: int
    rating_before: int
    rating_after: int
    rating_change: int
    xp_earned: int


class DailyPuzzleItem(BaseModel):
    """Daily puzzle with attempt status."""

    puzzle: PuzzleItem
    sort_order: int
    attempted: bool = False
    is_correct: Optional[bool] = None


class DailyPuzzlesResponse(BaseModel):
    """Today's daily puzzles."""

    date: str
    puzzles: list[DailyPuzzleItem]
    quota: dict


class ChallengeLevelProgress(BaseModel):
    """Progress for a single challenge difficulty level."""

    level: int
    total_puzzles: int
    solved_puzzles: int
    progress_pct: int


class ChallengeProgressResponse(BaseModel):
    """Challenge progress across all levels."""

    levels: list[ChallengeLevelProgress]


class MistakeItem(BaseModel):
    """A mistake puzzle entry."""

    attempt_id: str
    puzzle: PuzzleItem
    user_moves: str
    attempted_at: datetime
    retried: bool = False

    model_config = {"from_attributes": True}


class MistakeListResponse(BaseModel):
    """Mistake list."""

    mistakes: list[MistakeItem]
    total: int


class PuzzleStatsResponse(BaseModel):
    """Puzzle statistics."""

    puzzle_rating: int
    total_attempted: int
    total_correct: int
    accuracy_pct: float
    daily_attempted_today: int
    streak: int = 0
    challenge_progress: list[ChallengeLevelProgress]


class ChallengePuzzleItem(PuzzleItem):
    """A puzzle within a challenge level, with user attempt status."""

    attempted: bool = False
    is_correct: Optional[bool] = None
