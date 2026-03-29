"""Assessment module schemas."""

from typing import List, Optional

from pydantic import BaseModel, Field


class AssessmentQuestion(BaseModel):
    """A single assessment question."""

    id: str
    question: str
    image_url: Optional[str] = None
    options: List["AssessmentOption"]
    difficulty: str = "beginner"


class AssessmentOption(BaseModel):
    """An option for an assessment question."""

    key: str
    label: str
    is_correct: bool = False


class AssessmentQuestionsResponse(BaseModel):
    """Assessment questions list response."""

    experience_level: str
    questions: List[AssessmentQuestion]


class SubmitAssessmentRequest(BaseModel):
    """Submit assessment answers."""

    experience_level: str = Field(..., description="User's self-reported experience: none, beginner, intermediate, advanced")
    answers: List["AnswerItem"]


class AnswerItem(BaseModel):
    """A single answer."""

    question_id: str
    selected_key: str


class AssessmentResultResponse(BaseModel):
    """Assessment result."""

    initial_rating: int
    rank_title: str
    rank_tier: int
    correct_count: int
    total_count: int
    message: str
