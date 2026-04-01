"""Learn module schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class LessonBrief(BaseModel):
    """Lesson summary for course detail."""

    id: str
    slug: str
    title: str
    unit_name: Optional[str] = None
    unit_order: int
    lesson_order: int
    content_type: str
    estimated_minutes: Optional[int] = None
    xp_reward: int
    status: str = "not_started"
    progress_pct: int = 0

    model_config = {"from_attributes": True}


class CourseListItem(BaseModel):
    """Course in the course list."""

    id: str
    slug: str
    title: str
    description: Optional[str] = None
    level: int
    total_lessons: int
    is_free: bool
    membership_required: Optional[str] = None
    sort_order: int
    completed_lessons: int = 0
    progress_pct: int = 0

    model_config = {"from_attributes": True}


class CourseDetail(BaseModel):
    """Course detail with lessons."""

    id: str
    slug: str
    title: str
    description: Optional[str] = None
    level: int
    total_lessons: int
    is_free: bool
    membership_required: Optional[str] = None
    completed_lessons: int = 0
    progress_pct: int = 0
    lessons: list[LessonBrief] = []

    model_config = {"from_attributes": True}


class LessonContent(BaseModel):
    """Full lesson content."""

    id: str
    slug: str
    title: str
    course_id: str
    course_title: str
    unit_name: Optional[str] = None
    lesson_order: int
    content_type: str
    content_data: dict
    ai_teaching_prompt: Optional[str] = None
    estimated_minutes: Optional[int] = None
    xp_reward: int
    next_lesson_id: Optional[str] = None
    status: str = "not_started"
    progress_pct: int = 0

    model_config = {"from_attributes": True}


class UpdateProgressRequest(BaseModel):
    """Update lesson progress."""

    progress_pct: int = Field(..., ge=0, le=100)
    last_position: Optional[dict] = None


class UpdateProgressResponse(BaseModel):
    """Progress update result."""

    lesson_id: str
    status: str
    progress_pct: int
    xp_earned: int = 0
    completed: bool = False


class ExerciseItem(BaseModel):
    """An exercise."""

    id: str
    exercise_order: int
    exercise_type: str
    question_text: str
    fen: Optional[str] = None
    options: Optional[dict] = None
    attempted: bool = False
    is_correct: Optional[bool] = None

    model_config = {"from_attributes": True}


class ExerciseAttemptRequest(BaseModel):
    """Submit exercise answer."""

    user_answer: str = Field(..., description="User's answer")
    time_spent_ms: Optional[int] = Field(None, ge=0)


class ExerciseAttemptResponse(BaseModel):
    """Result after submitting exercise."""

    is_correct: bool
    correct_answer: str
    explanation: Optional[str] = None
    xp_earned: int = 0


class ExerciseOverviewLesson(BaseModel):
    """Per-lesson exercise summary in the overview."""

    lesson_id: str
    lesson_title: str
    lesson_order: int
    exercise_count: int = 0
    completed_count: int = 0
    score: int = 0
    total: int = 0
    status: str = "not_started"  # not_started | in_progress | completed
    lesson_learned: bool = False

    model_config = {"from_attributes": True}


class ExerciseOverviewCourse(BaseModel):
    """Per-course exercise overview."""

    course_id: str
    course_title: str
    course_level: int
    lessons: list[ExerciseOverviewLesson] = []

    model_config = {"from_attributes": True}


class AITeachRequest(BaseModel):
    """AI interactive teaching request."""

    message: str = Field(..., description="User's message or question")
    context: Optional[dict] = Field(None, description="Current lesson context")


class AITeachResponse(BaseModel):
    """AI teaching response."""

    reply: str
    board_fen: Optional[str] = None
    suggested_moves: Optional[list[str]] = None
