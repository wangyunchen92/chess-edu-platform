"""Dashboard module router (B2-11)."""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.game import Game
from app.models.gamification import UserRating, UserStreak
from app.schemas.common import APIResponse
from app.schemas.dashboard import DashboardResponse
from app.services import notification_service, train_service
from app.services.gamification_service import get_level_for_xp
from app.services.membership_service import get_daily_quota

router = APIRouter()


@router.get("", response_model=APIResponse[DashboardResponse])
def get_dashboard(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[DashboardResponse]:
    """Get dashboard aggregated data."""
    user_id = current_user["user_id"]

    # Training progress
    plan = train_service.get_or_create_today_plan(db, user_id)
    train_progress = {
        "total_items": plan["total_items"],
        "completed_items": plan["completed_items"],
        "is_completed": plan["is_completed"],
    }

    # Rating
    user_rating = db.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    ).scalar_one_or_none()

    rating_data = {
        "game_rating": user_rating.game_rating if user_rating else 300,
        "puzzle_rating": user_rating.puzzle_rating if user_rating else 300,
        "rank_title": user_rating.rank_title if user_rating else "apprentice_1",
        "rank_region": user_rating.rank_region if user_rating else "meadow",
    }

    xp_total = user_rating.xp_total if user_rating else 0
    xp_today = user_rating.xp_today if user_rating else 0
    level, xp_to_next_level = get_level_for_xp(xp_total)

    # Streak — also update if not yet updated today
    from datetime import date, timedelta
    import uuid as _uuid
    today = date.today()

    streak = db.execute(
        select(UserStreak).where(UserStreak.user_id == user_id)
    ).scalar_one_or_none()

    if streak is None:
        streak = UserStreak(
            id=str(_uuid.uuid4()),
            user_id=user_id,
            login_streak=1,
            login_streak_max=1,
            last_login_date=today,
        )
        db.add(streak)
        db.flush()
    elif streak.last_login_date != today:
        if streak.last_login_date == today - timedelta(days=1):
            streak.login_streak += 1
            if streak.login_streak > streak.login_streak_max:
                streak.login_streak_max = streak.login_streak
        else:
            streak.login_streak = 1
        streak.last_login_date = today
        db.add(streak)
        db.flush()

    streak_val = streak.login_streak

    # Recent games (last 3)
    games_stmt = (
        select(Game)
        .where(Game.user_id == user_id, Game.status == "completed")
        .order_by(Game.ended_at.desc())
        .limit(3)
    )
    recent_games_orm = db.execute(games_stmt).scalars().all()
    # Load character names for recent games
    from app.models.character import Character
    char_names: dict[str, str] = {}
    char_ids = {g.character_id for g in recent_games_orm if g.character_id}
    if char_ids:
        chars = db.execute(
            select(Character.id, Character.name).where(Character.id.in_(char_ids))
        ).all()
        char_names = {c.id: c.name for c in chars}

    recent_games = []
    for g in recent_games_orm:
        recent_games.append({
            "game_id": g.id,
            "character_name": char_names.get(g.character_id, g.character_id),
            "result": g.result,
            "rating_change": g.rating_change,
        })

    # Daily puzzles remaining
    puzzle_quota = get_daily_quota(db, user_id, "daily_puzzles")
    puzzles_remaining = puzzle_quota["remaining"] if puzzle_quota["limit"] != -1 else -1

    # Today's game count
    from datetime import date
    today = date.today()
    today_games_count = db.execute(
        select(func.count()).select_from(Game).where(
            Game.user_id == user_id,
            Game.status == "completed",
            func.date(Game.ended_at) == today,
        )
    ).scalar() or 0

    # Today's XP — use daily quota record for accurate today count
    from app.models.membership import UserDailyQuota
    today_quota = db.execute(
        select(UserDailyQuota).where(
            UserDailyQuota.user_id == user_id,
            UserDailyQuota.quota_date == today,
        )
    ).scalar_one_or_none()
    xp_earned_today = today_quota.xp_earned if today_quota else 0

    # Unread notifications
    unread = notification_service.get_unread_count(db, user_id)

    return APIResponse.success(data={
        "train_progress": train_progress,
        "rating": rating_data,
        "xp_today": xp_earned_today,
        "xp_total": xp_total,
        "level": level,
        "xp_to_next_level": xp_to_next_level,
        "streak": streak_val,
        "recent_games": recent_games,
        "today_games_count": today_games_count,
        "daily_puzzles_remaining": puzzles_remaining,
        "unread_notifications": unread,
    })
