"""Course, Lesson, Exercise, LessonProgress, and ExerciseAttempt ORM models."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    slug: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    prerequisite_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("courses.id"), nullable=True
    )
    total_lessons: Mapped[int] = mapped_column(Integer, nullable=False)
    is_free: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    membership_required: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    prerequisite: Mapped[Optional["Course"]] = relationship(
        "Course", remote_side="Course.id", lazy="noload"
    )
    lessons: Mapped[list["Lesson"]] = relationship(
        "Lesson", back_populates="course", lazy="noload", cascade="all, delete-orphan"
    )


class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        UniqueConstraint("course_id", "lesson_order", name="uq_lessons_course_order"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    course_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    slug: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    unit_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    unit_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    lesson_order: Mapped[int] = mapped_column(Integer, nullable=False)
    content_type: Mapped[str] = mapped_column(String(20), nullable=False, default="interactive")
    content_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    ai_teaching_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estimated_minutes: Mapped[Optional[int]] = mapped_column(Integer, default=10, nullable=True)
    xp_reward: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    course: Mapped["Course"] = relationship("Course", back_populates="lessons")
    exercises: Mapped[list["Exercise"]] = relationship(
        "Exercise", back_populates="lesson", lazy="noload", cascade="all, delete-orphan"
    )
    progresses: Mapped[list["LessonProgress"]] = relationship(
        "LessonProgress", back_populates="lesson", lazy="noload"
    )


class Exercise(Base):
    __tablename__ = "exercises"
    __table_args__ = (
        UniqueConstraint("lesson_id", "exercise_order", name="uq_exercises_lesson_order"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    lesson_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    exercise_order: Mapped[int] = mapped_column(Integer, nullable=False)
    exercise_type: Mapped[str] = mapped_column(String(20), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    fen: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    options: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    correct_answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="exercises")
    attempts: Mapped[list["ExerciseAttempt"]] = relationship(
        "ExerciseAttempt", back_populates="exercise", lazy="noload"
    )


class LessonProgress(Base):
    __tablename__ = "lesson_progresses"
    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_lesson_progress_user_lesson"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    lesson_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="not_started")
    progress_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    exercise_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    exercise_total: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_position: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="lesson_progresses")
    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="progresses")


class ExerciseAttempt(Base):
    __tablename__ = "exercise_attempts"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False
    )
    user_answer: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    time_spent_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="exercise_attempts")
    exercise: Mapped["Exercise"] = relationship("Exercise", back_populates="attempts")
