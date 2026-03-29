"""Course / Learn service layer (B2-3 & B2-4 & B2-5)."""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.course import Course, Exercise, ExerciseAttempt, Lesson, LessonProgress

# Content directory for course JSON files
CONTENT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "..", "content", "courses")


def list_courses(db: Session, user_id: str) -> list[dict]:
    """Get all courses with user progress."""
    stmt = select(Course).order_by(Course.sort_order, Course.level)
    courses = db.execute(stmt).scalars().all()

    result = []
    for course in courses:
        # Count completed lessons for this user
        completed_stmt = select(func.count()).select_from(LessonProgress).join(
            Lesson, Lesson.id == LessonProgress.lesson_id
        ).where(
            LessonProgress.user_id == user_id,
            Lesson.course_id == course.id,
            LessonProgress.status == "completed",
        )
        completed = db.execute(completed_stmt).scalar() or 0
        pct = int(completed / course.total_lessons * 100) if course.total_lessons > 0 else 0

        result.append({
            "id": course.id,
            "slug": course.slug,
            "title": course.title,
            "description": course.description,
            "level": course.level,
            "total_lessons": course.total_lessons,
            "is_free": course.is_free,
            "membership_required": course.membership_required,
            "sort_order": course.sort_order,
            "completed_lessons": completed,
            "progress_pct": pct,
        })

    return result


def get_course_detail(db: Session, course_id: str, user_id: str) -> dict | None:
    """Get course detail with lesson list and progress."""
    course = db.execute(
        select(Course).where(Course.id == course_id)
    ).scalar_one_or_none()
    if course is None:
        return None

    # Get lessons
    lessons_stmt = (
        select(Lesson)
        .where(Lesson.course_id == course_id)
        .order_by(Lesson.unit_order, Lesson.lesson_order)
    )
    lessons = db.execute(lessons_stmt).scalars().all()

    # Get user progress for these lessons
    lesson_ids = [l.id for l in lessons]
    progress_stmt = select(LessonProgress).where(
        LessonProgress.user_id == user_id,
        LessonProgress.lesson_id.in_(lesson_ids),
    ) if lesson_ids else None

    progress_map = {}
    if progress_stmt is not None:
        progresses = db.execute(progress_stmt).scalars().all()
        progress_map = {p.lesson_id: p for p in progresses}

    lesson_items = []
    completed_count = 0
    for lesson in lessons:
        prog = progress_map.get(lesson.id)
        status = prog.status if prog else "not_started"
        pct = prog.progress_pct if prog else 0
        if status == "completed":
            completed_count += 1
        lesson_items.append({
            "id": lesson.id,
            "slug": lesson.slug,
            "title": lesson.title,
            "unit_name": lesson.unit_name,
            "unit_order": lesson.unit_order,
            "lesson_order": lesson.lesson_order,
            "content_type": lesson.content_type,
            "estimated_minutes": lesson.estimated_minutes,
            "xp_reward": lesson.xp_reward,
            "status": status,
            "progress_pct": pct,
        })

    course_pct = int(completed_count / course.total_lessons * 100) if course.total_lessons > 0 else 0

    return {
        "id": course.id,
        "slug": course.slug,
        "title": course.title,
        "description": course.description,
        "level": course.level,
        "total_lessons": course.total_lessons,
        "is_free": course.is_free,
        "membership_required": course.membership_required,
        "completed_lessons": completed_count,
        "progress_pct": course_pct,
        "lessons": lesson_items,
    }


def get_lesson_content(db: Session, lesson_id: str, user_id: str) -> dict | None:
    """Get lesson full content. Content is read from DB content_data or content JSON files."""
    lesson = db.execute(
        select(Lesson).where(Lesson.id == lesson_id)
    ).scalar_one_or_none()
    if lesson is None:
        return None

    # Get course title
    course = db.execute(
        select(Course).where(Course.id == lesson.course_id)
    ).scalar_one_or_none()
    course_title = course.title if course else ""

    # Try loading content from JSON file if content_data is empty/minimal
    content_data = lesson.content_data or {}
    if not content_data or content_data == {}:
        content_data = _load_content_from_file(course.slug if course else "", lesson.slug)

    # Get user progress
    prog = db.execute(
        select(LessonProgress).where(
            LessonProgress.user_id == user_id,
            LessonProgress.lesson_id == lesson_id,
        )
    ).scalar_one_or_none()

    # Find next lesson in the same course (lesson_order + 1)
    next_lesson = db.execute(
        select(Lesson).where(
            Lesson.course_id == lesson.course_id,
            Lesson.lesson_order == lesson.lesson_order + 1,
        )
    ).scalar_one_or_none()

    return {
        "id": lesson.id,
        "slug": lesson.slug,
        "title": lesson.title,
        "course_id": lesson.course_id,
        "course_title": course_title,
        "unit_name": lesson.unit_name,
        "lesson_order": lesson.lesson_order,
        "content_type": lesson.content_type,
        "content_data": content_data,
        "ai_teaching_prompt": lesson.ai_teaching_prompt,
        "estimated_minutes": lesson.estimated_minutes,
        "xp_reward": lesson.xp_reward,
        "next_lesson_id": next_lesson.id if next_lesson else None,
        "status": prog.status if prog else "not_started",
        "progress_pct": prog.progress_pct if prog else 0,
    }


def update_lesson_progress(
    db: Session, lesson_id: str, user_id: str, progress_pct: int, last_position: dict | None = None
) -> dict:
    """Update lesson progress, potentially marking as complete."""
    lesson = db.execute(
        select(Lesson).where(Lesson.id == lesson_id)
    ).scalar_one_or_none()
    if lesson is None:
        raise ValueError("Lesson not found")

    prog = db.execute(
        select(LessonProgress).where(
            LessonProgress.user_id == user_id,
            LessonProgress.lesson_id == lesson_id,
        )
    ).scalar_one_or_none()

    xp_earned = 0
    was_completed = False

    if prog is None:
        prog = LessonProgress(
            id=str(uuid.uuid4()),
            user_id=user_id,
            lesson_id=lesson_id,
            status="in_progress",
            progress_pct=0,
            started_at=datetime.now(timezone.utc),
        )
        db.add(prog)
        db.flush()

    # Only allow progress to go forward
    if progress_pct > prog.progress_pct:
        prog.progress_pct = progress_pct

    if last_position is not None:
        prog.last_position = last_position

    completed = progress_pct >= 100
    if completed and prog.status != "completed":
        prog.status = "completed"
        prog.completed_at = datetime.now(timezone.utc)
        xp_earned = lesson.xp_reward
        was_completed = True
    elif not completed and prog.status == "not_started":
        prog.status = "in_progress"

    db.add(prog)
    db.flush()

    return {
        "lesson_id": lesson_id,
        "status": prog.status,
        "progress_pct": prog.progress_pct,
        "xp_earned": xp_earned,
        "completed": was_completed,
    }


def get_lesson_exercises(db: Session, lesson_id: str, user_id: str) -> list[dict]:
    """Get exercises for a lesson with user attempt status."""
    stmt = (
        select(Exercise)
        .where(Exercise.lesson_id == lesson_id)
        .order_by(Exercise.exercise_order)
    )
    exercises = db.execute(stmt).scalars().all()

    if not exercises:
        return []

    exercise_ids = [e.id for e in exercises]
    attempts_stmt = select(ExerciseAttempt).where(
        ExerciseAttempt.user_id == user_id,
        ExerciseAttempt.exercise_id.in_(exercise_ids),
    )
    attempts = db.execute(attempts_stmt).scalars().all()
    # Keep best attempt per exercise
    attempt_map: dict[str, ExerciseAttempt] = {}
    for a in attempts:
        existing = attempt_map.get(a.exercise_id)
        if existing is None or (a.is_correct and not existing.is_correct):
            attempt_map[a.exercise_id] = a

    result = []
    for e in exercises:
        att = attempt_map.get(e.id)
        result.append({
            "id": e.id,
            "exercise_order": e.exercise_order,
            "exercise_type": e.exercise_type,
            "question_text": e.question_text,
            "fen": e.fen,
            "options": e.options,
            "attempted": att is not None,
            "is_correct": att.is_correct if att else None,
        })

    return result


def submit_exercise_attempt(
    db: Session, exercise_id: str, user_id: str, user_answer: str, time_spent_ms: int | None = None
) -> dict:
    """Submit an exercise answer and check correctness."""
    exercise = db.execute(
        select(Exercise).where(Exercise.id == exercise_id)
    ).scalar_one_or_none()
    if exercise is None:
        raise ValueError("Exercise not found")

    is_correct = user_answer.strip().lower() == exercise.correct_answer.strip().lower()

    attempt = ExerciseAttempt(
        id=str(uuid.uuid4()),
        user_id=user_id,
        exercise_id=exercise_id,
        user_answer=user_answer,
        is_correct=is_correct,
        time_spent_ms=time_spent_ms,
    )
    db.add(attempt)

    # Update lesson progress exercise score
    lesson = db.execute(
        select(Lesson).where(Lesson.id == exercise.lesson_id)
    ).scalar_one_or_none()

    if lesson:
        prog = db.execute(
            select(LessonProgress).where(
                LessonProgress.user_id == user_id,
                LessonProgress.lesson_id == lesson.id,
            )
        ).scalar_one_or_none()

        if prog:
            # Count correct exercises for this lesson
            correct_count_stmt = (
                select(func.count(func.distinct(ExerciseAttempt.exercise_id)))
                .select_from(ExerciseAttempt)
                .join(Exercise, Exercise.id == ExerciseAttempt.exercise_id)
                .where(
                    ExerciseAttempt.user_id == user_id,
                    Exercise.lesson_id == lesson.id,
                    ExerciseAttempt.is_correct.is_(True),
                )
            )
            correct_count = db.execute(correct_count_stmt).scalar() or 0
            total_exercises_stmt = select(func.count()).select_from(Exercise).where(
                Exercise.lesson_id == lesson.id
            )
            total_exercises = db.execute(total_exercises_stmt).scalar() or 0

            prog.exercise_score = correct_count
            prog.exercise_total = total_exercises
            db.add(prog)

    db.flush()

    xp_earned = 5 if is_correct else 0

    return {
        "is_correct": is_correct,
        "correct_answer": exercise.correct_answer,
        "explanation": exercise.explanation,
        "xp_earned": xp_earned,
    }


def ai_teach_interaction(
    db: Session, lesson_id: str, user_id: str, message: str, context: dict | None = None
) -> dict:
    """Handle AI interactive teaching. Returns a simulated response
    (actual LLM integration would be added later)."""
    lesson = db.execute(
        select(Lesson).where(Lesson.id == lesson_id)
    ).scalar_one_or_none()
    if lesson is None:
        raise ValueError("Lesson not found")

    # Build a teaching response based on the lesson context
    teaching_prompt = lesson.ai_teaching_prompt or ""
    content_data = lesson.content_data or {}

    # For now return a template response; in production this would call an LLM
    reply = (
        f"Great question! In this lesson about '{lesson.title}', "
        f"let me help you understand. {teaching_prompt or 'Keep practicing the concepts we covered!'}"
    )

    # Extract board FEN from content if available
    board_fen = content_data.get("fen") if isinstance(content_data, dict) else None

    return {
        "reply": reply,
        "board_fen": board_fen,
        "suggested_moves": None,
    }


def _load_content_from_file(course_slug: str, lesson_slug: str) -> dict:
    """Try to load lesson content from a JSON file in content/courses/."""
    if not course_slug or not lesson_slug:
        return {}
    filepath = os.path.join(CONTENT_DIR, course_slug, f"{lesson_slug}.json")
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {}
    return {}
