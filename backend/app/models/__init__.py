"""SQLAlchemy ORM models package."""

from app.models.achievement import Achievement, UserAchievement
from app.models.adventure import PromotionChallenge
from app.models.character import Character, CharacterDialogue, UserCharacterRelation
from app.models.course import Course, Exercise, ExerciseAttempt, Lesson, LessonProgress
from app.models.game import Game, GameMove
from app.models.gamification import RatingHistory, UserRating, UserStreak
from app.models.membership import MembershipPlan, UserDailyQuota
from app.models.notification import Notification
from app.models.puzzle import DailyPuzzle, Puzzle, PuzzleAttempt
from app.models.train import DailyTrainPlan, DailyTrainRecord
from app.models.user import User, UserProfile

__all__ = [
    # User
    "User",
    "UserProfile",
    # Game
    "Game",
    "GameMove",
    # Puzzle
    "Puzzle",
    "DailyPuzzle",
    "PuzzleAttempt",
    # Course
    "Course",
    "Lesson",
    "Exercise",
    "LessonProgress",
    "ExerciseAttempt",
    # Train
    "DailyTrainPlan",
    "DailyTrainRecord",
    # Achievement
    "Achievement",
    "UserAchievement",
    # Membership
    "MembershipPlan",
    "UserDailyQuota",
    # Character
    "Character",
    "CharacterDialogue",
    "UserCharacterRelation",
    # Gamification
    "UserRating",
    "RatingHistory",
    "UserStreak",
    # Notification
    "Notification",
    # Adventure
    "PromotionChallenge",
]
