"""Schemas for teacher-side APIs."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CreateInviteCodeRequest(BaseModel):
    max_uses: int = Field(default=30, ge=1, le=200)


class InviteCodeResponse(BaseModel):
    id: str
    code: str
    max_uses: int
    used_count: int
    status: str
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentSummary(BaseModel):
    total_games: int = 0
    win_rate: float = 0.0
    total_puzzles: int = 0
    puzzle_accuracy: float = 0.0
    course_completion: float = 0.0
    game_rating: int = 300
    puzzle_rating: int = 300
    rank_title: str = "apprentice_1"
    last_active_at: Optional[datetime] = None


class TeacherStudentItem(BaseModel):
    student_id: str
    username: str
    nickname: str
    avatar_url: Optional[str] = None
    remark_name: Optional[str] = None
    bindtime: datetime
    summary: StudentSummary


class TeacherStudentListResponse(BaseModel):
    items: List[TeacherStudentItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class StudentProfileInfo(BaseModel):
    birth_year: Optional[int] = None
    chess_experience: Optional[str] = None
    assessment_done: bool = False
    initial_rating: Optional[int] = None


class StudentRatingsInfo(BaseModel):
    game_rating: int = 300
    puzzle_rating: int = 300
    rank_title: str = "apprentice_1"
    rank_tier: int = 1
    rank_region: str = "meadow"
    xp_total: int = 0
    coins: int = 0


class RecentGameItem(BaseModel):
    id: str
    character_name: Optional[str] = None
    result: Optional[str] = None
    rating_change: Optional[int] = 0
    played_at: Optional[datetime] = None


class GameStatsInfo(BaseModel):
    total_games: int = 0
    wins: int = 0
    losses: int = 0
    draws: int = 0
    win_rate: float = 0.0
    recent_games: List[RecentGameItem] = Field(default_factory=list)


class PuzzleStatsInfo(BaseModel):
    total_attempts: int = 0
    correct_count: int = 0
    accuracy: float = 0.0
    current_streak: int = 0


class CourseProgressItem(BaseModel):
    course_id: str
    title: str
    total_lessons: int
    completed: int
    progress: float


class CourseStatsInfo(BaseModel):
    total_lessons: int = 0
    completed_lessons: int = 0
    completion_rate: float = 0.0
    courses: List[CourseProgressItem] = Field(default_factory=list)


class StreakInfo(BaseModel):
    current_login_streak: int = 0
    max_login_streak: int = 0
    current_train_streak: int = 0


class StudentDetailResponse(BaseModel):
    student_id: str
    username: str
    nickname: str
    avatar_url: Optional[str] = None
    bindtime: datetime
    profile: StudentProfileInfo
    ratings: StudentRatingsInfo
    game_stats: GameStatsInfo
    puzzle_stats: PuzzleStatsInfo
    course_stats: CourseStatsInfo
    streak: StreakInfo
    last_active_at: Optional[datetime] = None
