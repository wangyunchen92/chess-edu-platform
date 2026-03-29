"""User service layer (B1-7, B3-5)."""

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.achievement import Achievement, UserAchievement
from app.models.course import Course, Lesson, LessonProgress
from app.models.game import Game
from app.models.gamification import UserRating
from app.models.puzzle import PuzzleAttempt
from app.models.user import User, UserProfile
from app.schemas.user import (
    AchievementBrief,
    GameStats,
    LearningStats,
    ProfileStatsResponse,
    PuzzleStats,
    UpdateSettingsRequest,
    UpdateUserRequest,
    UserFullResponse,
    UserProfileResponse,
    UserRatingResponse,
    UserStreakResponse,
)


def get_user_full(db: Session, user_id: str) -> Optional[UserFullResponse]:
    """Get full user information including profile, rating, and streak.

    Args:
        db: Database session.
        user_id: User ID.

    Returns:
        UserFullResponse or None.
    """
    stmt = select(User).where(User.id == user_id)
    user = db.execute(stmt).scalar_one_or_none()
    if user is None:
        return None

    profile_data = None
    if user.profile:
        profile_data = UserProfileResponse.model_validate(user.profile)

    rating_data = None
    if user.rating:
        rating_data = UserRatingResponse.model_validate(user.rating)

    streak_data = None
    if user.streak:
        streak_data = UserStreakResponse.model_validate(user.streak)

    return UserFullResponse(
        id=user.id,
        username=user.username,
        nickname=user.nickname,
        avatar_url=user.avatar_url,
        role=user.role,
        status=user.status,
        membership_tier=user.membership_tier,
        membership_expires_at=user.membership_expires_at,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        login_count=user.login_count,
        profile=profile_data,
        rating=rating_data,
        streak=streak_data,
    )


def update_user_info(
    db: Session,
    user_id: str,
    data: UpdateUserRequest,
) -> Optional[UserFullResponse]:
    """Update user's basic info (nickname, avatar_url).

    Args:
        db: Database session.
        user_id: User ID.
        data: Fields to update.

    Returns:
        Updated UserFullResponse or None.
    """
    stmt = select(User).where(User.id == user_id)
    user = db.execute(stmt).scalar_one_or_none()
    if user is None:
        return None

    if data.nickname is not None:
        user.nickname = data.nickname
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url

    db.add(user)
    db.flush()

    return get_user_full(db, user_id)


def update_user_settings(
    db: Session,
    user_id: str,
    data: UpdateSettingsRequest,
) -> Optional[UserFullResponse]:
    """Update user's settings (theme, sound, notification, etc.).

    Args:
        db: Database session.
        user_id: User ID.
        data: Settings to update.

    Returns:
        Updated UserFullResponse or None.
    """
    stmt = select(User).where(User.id == user_id)
    user = db.execute(stmt).scalar_one_or_none()
    if user is None:
        return None

    # Ensure profile exists
    profile = user.profile
    if profile is None:
        import uuid
        profile = UserProfile(
            id=str(uuid.uuid4()),
            user_id=user_id,
        )
        db.add(profile)
        db.flush()

    if data.theme is not None:
        profile.theme = data.theme
    if data.sound_enabled is not None:
        profile.sound_enabled = data.sound_enabled
    if data.notification_enabled is not None:
        profile.notification_enabled = data.notification_enabled
    if data.daily_remind_time is not None:
        profile.daily_remind_time = data.daily_remind_time
    if data.preferred_time is not None:
        profile.preferred_time = data.preferred_time

    db.add(profile)
    db.flush()

    return get_user_full(db, user_id)


def get_profile_stats(db: Session, user_id: str) -> Optional[ProfileStatsResponse]:
    """Get aggregated profile statistics for a user.

    Includes game stats, puzzle stats, learning stats, and recent achievements.

    Args:
        db: Database session.
        user_id: User ID.

    Returns:
        ProfileStatsResponse or None if user not found.
    """
    # Verify user exists
    user_stmt = select(User).where(User.id == user_id)
    user = db.execute(user_stmt).scalar_one_or_none()
    if user is None:
        return None

    # ── Game stats ───────────────────────────────────────────────
    game_total_stmt = select(func.count()).select_from(Game).where(
        Game.user_id == user_id,
        Game.status == "completed",
    )
    game_total = db.execute(game_total_stmt).scalar() or 0

    game_win_stmt = select(func.count()).select_from(Game).where(
        Game.user_id == user_id,
        Game.status == "completed",
        Game.result == "win",
    )
    game_wins = db.execute(game_win_stmt).scalar() or 0

    game_loss_stmt = select(func.count()).select_from(Game).where(
        Game.user_id == user_id,
        Game.status == "completed",
        Game.result == "loss",
    )
    game_losses = db.execute(game_loss_stmt).scalar() or 0

    game_draw_stmt = select(func.count()).select_from(Game).where(
        Game.user_id == user_id,
        Game.status == "completed",
        Game.result == "draw",
    )
    game_draws = db.execute(game_draw_stmt).scalar() or 0

    win_rate = round(game_wins / game_total * 100, 1) if game_total > 0 else 0.0

    game_stats = GameStats(
        total_games=game_total,
        wins=game_wins,
        losses=game_losses,
        draws=game_draws,
        win_rate=win_rate,
    )

    # ── Puzzle stats ─────────────────────────────────────────────
    puzzle_total_stmt = select(func.count()).select_from(PuzzleAttempt).where(
        PuzzleAttempt.user_id == user_id,
    )
    puzzle_total = db.execute(puzzle_total_stmt).scalar() or 0

    puzzle_correct_stmt = select(func.count()).select_from(PuzzleAttempt).where(
        PuzzleAttempt.user_id == user_id,
        PuzzleAttempt.is_correct.is_(True),
    )
    puzzle_correct = db.execute(puzzle_correct_stmt).scalar() or 0

    puzzle_accuracy = round(puzzle_correct / puzzle_total * 100, 1) if puzzle_total > 0 else 0.0

    # Get puzzle rating from UserRating
    rating_stmt = select(UserRating).where(UserRating.user_id == user_id)
    user_rating = db.execute(rating_stmt).scalar_one_or_none()
    puzzle_rating = user_rating.puzzle_rating if user_rating else 300

    puzzle_stats = PuzzleStats(
        total_solved=puzzle_total,
        accuracy=puzzle_accuracy,
        puzzle_rating=puzzle_rating,
    )

    # ── Learning stats ───────────────────────────────────────────
    completed_lessons_stmt = select(func.count()).select_from(LessonProgress).where(
        LessonProgress.user_id == user_id,
        LessonProgress.status == "completed",
    )
    completed_lessons = db.execute(completed_lessons_stmt).scalar() or 0

    total_lessons_stmt = select(func.count()).select_from(Lesson)
    total_lessons = db.execute(total_lessons_stmt).scalar() or 0

    learning_stats = LearningStats(
        completed_lessons=completed_lessons,
        total_lessons=total_lessons,
    )

    # ── Recent achievements (max 3) ─────────────────────────────
    ach_stmt = (
        select(UserAchievement)
        .where(UserAchievement.user_id == user_id)
        .order_by(UserAchievement.achieved_at.desc())
        .limit(3)
    )
    user_achs = db.execute(ach_stmt).scalars().all()

    recent_achievements = []
    if user_achs:
        ach_ids = [ua.achievement_id for ua in user_achs]
        ach_detail_stmt = select(Achievement).where(Achievement.id.in_(ach_ids))
        ach_details = db.execute(ach_detail_stmt).scalars().all()
        ach_map = {a.id: a for a in ach_details}

        for ua in user_achs:
            ach = ach_map.get(ua.achievement_id)
            if ach:
                recent_achievements.append(
                    AchievementBrief(
                        id=ach.id,
                        name=ach.name,
                        icon_key=ach.icon_key,
                        achieved_at=ua.achieved_at,
                    )
                )

    return ProfileStatsResponse(
        game_stats=game_stats,
        puzzle_stats=puzzle_stats,
        learning_stats=learning_stats,
        recent_achievements=recent_achievements,
    )
