"""Teacher-side business logic: invite codes, student list, student detail."""

import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.course import Course, Lesson, LessonProgress
from app.models.game import Game
from app.models.gamification import UserRating, UserStreak
from app.models.puzzle import PuzzleAttempt
from app.models.teacher import InviteCode, TeacherStudent
from app.models.user import User, UserProfile
from app.schemas.teacher import (
    CourseProgressItem,
    CourseStatsInfo,
    GameStatsInfo,
    InviteCodeResponse,
    PuzzleStatsInfo,
    RecentGameItem,
    StreakInfo,
    StudentDetailResponse,
    StudentProfileInfo,
    StudentRatingsInfo,
    StudentSummary,
    TeacherStudentItem,
    TeacherStudentListResponse,
)

# Max active invite codes per teacher
MAX_ACTIVE_CODES = 3
# Default expiry hours
DEFAULT_EXPIRES_HOURS = 72


def _generate_code(length: int = 6) -> str:
    """Generate a random code of uppercase letters and digits."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


def create_invite_code(
    db: Session,
    teacher_id: str,
    max_uses: int = 30,
) -> InviteCode:
    """Generate an invite code for a teacher.

    Raises ValueError if the teacher already has MAX_ACTIVE_CODES active codes.
    """
    # Check active code count
    active_count = db.execute(
        select(func.count())
        .select_from(InviteCode)
        .where(
            InviteCode.teacher_id == teacher_id,
            InviteCode.status == "active",
            InviteCode.expires_at > func.now(),
        )
    ).scalar_one()

    if active_count >= MAX_ACTIVE_CODES:
        raise ValueError(f"Active invite code limit reached (max {MAX_ACTIVE_CODES})")

    # Generate unique code with retry
    for _ in range(10):
        code = _generate_code()
        exists = db.execute(
            select(InviteCode.id).where(InviteCode.code == code)
        ).first()
        if not exists:
            break
    else:
        raise ValueError("Failed to generate unique code, please try again")

    expires_at = datetime.now(timezone.utc) + timedelta(hours=DEFAULT_EXPIRES_HOURS)

    invite = InviteCode(
        teacher_id=teacher_id,
        code=code,
        max_uses=max_uses,
        expires_at=expires_at,
    )
    db.add(invite)
    db.flush()
    return invite


def list_invite_codes(db: Session, teacher_id: str) -> list[InviteCodeResponse]:
    """Return all invite codes for a teacher, newest first."""
    stmt = (
        select(InviteCode)
        .where(InviteCode.teacher_id == teacher_id)
        .order_by(InviteCode.created_at.desc())
    )
    codes = db.execute(stmt).scalars().all()
    return [InviteCodeResponse.model_validate(c) for c in codes]


def revoke_invite_code(db: Session, teacher_id: str, code_id: str) -> None:
    """Revoke an invite code. Raises ValueError if not found or not owned."""
    invite = db.execute(
        select(InviteCode).where(
            InviteCode.id == code_id,
            InviteCode.teacher_id == teacher_id,
        )
    ).scalar_one_or_none()

    if invite is None:
        raise ValueError("Invite code not found")

    if invite.status != "active":
        raise ValueError("Invite code is not active")

    invite.status = "revoked"
    db.flush()


def list_students(
    db: Session,
    teacher_id: str,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
) -> TeacherStudentListResponse:
    """Return paginated student list with summary data."""
    # Base query: active bindings for this teacher
    base = (
        select(
            TeacherStudent.student_id,
            TeacherStudent.created_at.label("bindtime"),
            User.username,
            User.nickname,
            User.avatar_url,
            User.last_login_at,
        )
        .join(User, User.id == TeacherStudent.student_id)
        .where(
            TeacherStudent.teacher_id == teacher_id,
            TeacherStudent.status == "active",
        )
    )

    if search:
        pattern = f"%{search}%"
        base = base.where(
            (User.username.ilike(pattern)) | (User.nickname.ilike(pattern))
        )

    # Count total
    count_stmt = select(func.count()).select_from(base.subquery())
    total = db.execute(count_stmt).scalar_one()

    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    # Paginate
    offset = (page - 1) * page_size
    rows = db.execute(
        base.order_by(TeacherStudent.created_at.desc())
        .offset(offset)
        .limit(page_size)
    ).all()

    if not rows:
        return TeacherStudentListResponse(
            items=[], total=total, page=page,
            page_size=page_size, total_pages=total_pages,
        )

    student_ids = [r.student_id for r in rows]

    # Batch aggregation: games
    game_stats = _aggregate_game_stats(db, student_ids)
    # Batch aggregation: puzzles
    puzzle_stats = _aggregate_puzzle_stats(db, student_ids)
    # Batch aggregation: course completion
    course_stats = _aggregate_course_completion(db, student_ids)
    # Ratings
    ratings_map = _get_ratings(db, student_ids)
    # Remarks (备注名)
    from app.services.remark_service import get_remarks_map
    remarks_map = get_remarks_map(db, teacher_id, student_ids)

    items = []
    for r in rows:
        sid = r.student_id
        gs = game_stats.get(sid, {})
        ps = puzzle_stats.get(sid, {})
        cs = course_stats.get(sid, {})
        rt = ratings_map.get(sid, {})

        total_games = gs.get("total", 0)
        wins = gs.get("wins", 0)

        total_puzzles = ps.get("total", 0)
        correct = ps.get("correct", 0)

        items.append(TeacherStudentItem(
            student_id=sid,
            username=r.username,
            nickname=r.nickname,
            avatar_url=r.avatar_url,
            remark_name=remarks_map.get(sid),
            bindtime=r.bindtime,
            summary=StudentSummary(
                total_games=total_games,
                win_rate=round(wins / total_games, 2) if total_games > 0 else 0.0,
                total_puzzles=total_puzzles,
                puzzle_accuracy=round(correct / total_puzzles, 2) if total_puzzles > 0 else 0.0,
                course_completion=cs.get("completion", 0.0),
                game_rating=rt.get("game_rating", 300),
                puzzle_rating=rt.get("puzzle_rating", 300),
                rank_title=rt.get("rank_title", "apprentice_1"),
                last_active_at=r.last_login_at,
            ),
        ))

    return TeacherStudentListResponse(
        items=items, total=total, page=page,
        page_size=page_size, total_pages=total_pages,
    )


def get_student_detail(
    db: Session,
    teacher_id: str,
    student_id: str,
) -> StudentDetailResponse:
    """Get detailed info for a single student bound to this teacher."""
    # Verify binding
    binding = db.execute(
        select(TeacherStudent).where(
            TeacherStudent.teacher_id == teacher_id,
            TeacherStudent.student_id == student_id,
            TeacherStudent.status == "active",
        )
    ).scalar_one_or_none()

    if binding is None:
        raise ValueError("Student not found or not bound to you")

    # Fetch student user
    student = db.execute(
        select(User).where(User.id == student_id)
    ).scalar_one_or_none()

    if student is None:
        raise ValueError("Student user not found")

    # Profile
    profile_info = StudentProfileInfo()
    if student.profile:
        profile_info = StudentProfileInfo(
            birth_year=student.profile.birth_year,
            chess_experience=student.profile.chess_experience,
            assessment_done=student.profile.assessment_done,
            initial_rating=student.profile.initial_rating,
        )

    # Ratings
    ratings_info = StudentRatingsInfo()
    if student.rating:
        ratings_info = StudentRatingsInfo(
            game_rating=student.rating.game_rating,
            puzzle_rating=student.rating.puzzle_rating,
            rank_title=student.rating.rank_title,
            rank_tier=student.rating.rank_tier,
            rank_region=student.rating.rank_region,
            xp_total=student.rating.xp_total,
            coins=student.rating.coins,
        )

    # Game stats
    game_stats = _build_game_stats(db, student_id)

    # Puzzle stats
    puzzle_stats = _build_puzzle_stats(db, student_id)

    # Course stats
    course_stats = _build_course_stats(db, student_id)

    # Streak
    streak_info = StreakInfo()
    if student.streak:
        streak_info = StreakInfo(
            current_login_streak=student.streak.login_streak,
            max_login_streak=student.streak.login_streak_max,
            current_train_streak=student.streak.train_streak,
        )

    return StudentDetailResponse(
        student_id=student_id,
        username=student.username,
        nickname=student.nickname,
        avatar_url=student.avatar_url,
        bindtime=binding.created_at,
        profile=profile_info,
        ratings=ratings_info,
        game_stats=game_stats,
        puzzle_stats=puzzle_stats,
        course_stats=course_stats,
        streak=streak_info,
        last_active_at=student.last_login_at,
    )


def remove_student(db: Session, teacher_id: str, student_id: str) -> None:
    """Remove (unbind) a student. Raises ValueError if not found."""
    binding = db.execute(
        select(TeacherStudent).where(
            TeacherStudent.teacher_id == teacher_id,
            TeacherStudent.student_id == student_id,
            TeacherStudent.status == "active",
        )
    ).scalar_one_or_none()

    if binding is None:
        raise ValueError("Student binding not found")

    binding.status = "removed"
    binding.removed_at = datetime.now(timezone.utc)
    db.flush()


# ── Private helpers ──────────────────────────────────────────────────────────


def _aggregate_game_stats(
    db: Session, student_ids: list[str]
) -> dict[str, dict]:
    """Batch aggregate game stats for multiple students."""
    stmt = (
        select(
            Game.user_id,
            func.count().label("total"),
            func.sum(case((Game.result == "win", 1), else_=0)).label("wins"),
        )
        .where(Game.user_id.in_(student_ids), Game.status == "completed")
        .group_by(Game.user_id)
    )
    result = {}
    for row in db.execute(stmt).all():
        result[row.user_id] = {"total": row.total, "wins": row.wins or 0}
    return result


def _aggregate_puzzle_stats(
    db: Session, student_ids: list[str]
) -> dict[str, dict]:
    """Batch aggregate puzzle stats for multiple students."""
    stmt = (
        select(
            PuzzleAttempt.user_id,
            func.count().label("total"),
            func.sum(case((PuzzleAttempt.is_correct == True, 1), else_=0)).label("correct"),  # noqa: E712
        )
        .where(PuzzleAttempt.user_id.in_(student_ids))
        .group_by(PuzzleAttempt.user_id)
    )
    result = {}
    for row in db.execute(stmt).all():
        result[row.user_id] = {"total": row.total, "correct": row.correct or 0}
    return result


def _aggregate_course_completion(
    db: Session, student_ids: list[str]
) -> dict[str, dict]:
    """Batch aggregate course completion for multiple students."""
    # Total lessons across all courses
    total_lessons_stmt = select(func.sum(Course.total_lessons))
    total_lessons = db.execute(total_lessons_stmt).scalar_one() or 0

    if total_lessons == 0:
        return {sid: {"completion": 0.0} for sid in student_ids}

    # Completed lessons per student
    stmt = (
        select(
            LessonProgress.user_id,
            func.count().label("completed"),
        )
        .where(
            LessonProgress.user_id.in_(student_ids),
            LessonProgress.status == "completed",
        )
        .group_by(LessonProgress.user_id)
    )
    result = {}
    for row in db.execute(stmt).all():
        result[row.user_id] = {
            "completion": round(row.completed / total_lessons, 2)
        }

    # Fill missing
    for sid in student_ids:
        if sid not in result:
            result[sid] = {"completion": 0.0}

    return result


def _get_ratings(
    db: Session, student_ids: list[str]
) -> dict[str, dict]:
    """Batch fetch ratings for multiple students."""
    stmt = select(UserRating).where(UserRating.user_id.in_(student_ids))
    result = {}
    for r in db.execute(stmt).scalars().all():
        result[r.user_id] = {
            "game_rating": r.game_rating,
            "puzzle_rating": r.puzzle_rating,
            "rank_title": r.rank_title,
        }
    return result


def _build_game_stats(db: Session, student_id: str) -> GameStatsInfo:
    """Build detailed game stats for a single student."""
    stmt = (
        select(
            func.count().label("total"),
            func.sum(case((Game.result == "win", 1), else_=0)).label("wins"),
            func.sum(case((Game.result == "loss", 1), else_=0)).label("losses"),
            func.sum(case((Game.result == "draw", 1), else_=0)).label("draws"),
        )
        .where(Game.user_id == student_id, Game.status == "completed")
    )
    row = db.execute(stmt).first()
    total = row.total or 0
    wins = row.wins or 0
    losses = row.losses or 0
    draws = row.draws or 0

    # Recent games (last 10)
    from app.models.character import Character

    recent_stmt = (
        select(
            Game.id,
            Character.name.label("character_name"),
            Game.result,
            Game.rating_change,
            Game.ended_at,
        )
        .join(Character, Character.id == Game.character_id, isouter=True)
        .where(Game.user_id == student_id, Game.status == "completed")
        .order_by(Game.ended_at.desc())
        .limit(10)
    )
    recent_rows = db.execute(recent_stmt).all()
    recent_games = [
        RecentGameItem(
            id=rg.id,
            character_name=rg.character_name,
            result=rg.result,
            rating_change=rg.rating_change or 0,
            played_at=rg.ended_at,
        )
        for rg in recent_rows
    ]

    return GameStatsInfo(
        total_games=total,
        wins=wins,
        losses=losses,
        draws=draws,
        win_rate=round(wins / total, 2) if total > 0 else 0.0,
        recent_games=recent_games,
    )


def _build_puzzle_stats(db: Session, student_id: str) -> PuzzleStatsInfo:
    """Build detailed puzzle stats for a single student."""
    stmt = (
        select(
            func.count().label("total"),
            func.sum(case((PuzzleAttempt.is_correct == True, 1), else_=0)).label("correct"),  # noqa: E712
        )
        .where(PuzzleAttempt.user_id == student_id)
    )
    row = db.execute(stmt).first()
    total = row.total or 0
    correct = row.correct or 0

    # Current streak: count consecutive correct attempts from most recent
    recent_attempts = db.execute(
        select(PuzzleAttempt.is_correct)
        .where(PuzzleAttempt.user_id == student_id)
        .order_by(PuzzleAttempt.created_at.desc())
        .limit(50)
    ).scalars().all()

    current_streak = 0
    for is_correct in recent_attempts:
        if is_correct:
            current_streak += 1
        else:
            break

    return PuzzleStatsInfo(
        total_attempts=total,
        correct_count=correct,
        accuracy=round(correct / total, 2) if total > 0 else 0.0,
        current_streak=current_streak,
    )


def _build_course_stats(db: Session, student_id: str) -> CourseStatsInfo:
    """Build detailed course stats for a single student."""
    # All courses with their lesson counts
    courses = db.execute(
        select(Course.id, Course.title, Course.total_lessons)
        .order_by(Course.sort_order)
    ).all()

    if not courses:
        return CourseStatsInfo()

    total_lessons = sum(c.total_lessons for c in courses)

    # Completed lessons per course for this student
    completed_stmt = (
        select(
            Lesson.course_id,
            func.count().label("completed"),
        )
        .join(LessonProgress, LessonProgress.lesson_id == Lesson.id)
        .where(
            LessonProgress.user_id == student_id,
            LessonProgress.status == "completed",
        )
        .group_by(Lesson.course_id)
    )
    completed_map = {}
    for row in db.execute(completed_stmt).all():
        completed_map[row.course_id] = row.completed

    total_completed = sum(completed_map.values())

    course_items = []
    for c in courses:
        completed = completed_map.get(c.id, 0)
        course_items.append(CourseProgressItem(
            course_id=c.id,
            title=c.title,
            total_lessons=c.total_lessons,
            completed=completed,
            progress=round(completed / c.total_lessons, 2) if c.total_lessons > 0 else 0.0,
        ))

    return CourseStatsInfo(
        total_lessons=total_lessons,
        completed_lessons=total_completed,
        completion_rate=round(total_completed / total_lessons, 2) if total_lessons > 0 else 0.0,
        courses=course_items,
    )
