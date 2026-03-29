"""Prompt templates for AI-powered chess education features."""

from app.ai.prompts.base import PromptTemplate
from app.ai.prompts.review import ReviewPrompt
from app.ai.prompts.puzzle_explain import PuzzleExplainPrompt
from app.ai.prompts.teaching import TeachingPrompt
from app.ai.prompts.assessment import AssessmentPrompt

__all__ = [
    "PromptTemplate",
    "ReviewPrompt",
    "PuzzleExplainPrompt",
    "TeachingPrompt",
    "AssessmentPrompt",
]
