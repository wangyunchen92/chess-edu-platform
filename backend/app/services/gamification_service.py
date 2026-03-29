"""Gamification service layer (B1-5, B2-8 ~ B2-10)."""

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.achievement import Achievement, UserAchievement
from app.models.game import Game
from app.models.gamification import RatingHistory, UserRating, UserStreak
from app.models.puzzle import PuzzleAttempt
from app.models.train import DailyTrainPlan
from app.utils.elo import calculate_new_rating


# ── Rank configuration ────────────────────────────────────────────

RANK_TIERS = [
    # (min_rating, rank_title, rank_tier, rank_region)
    (0, "apprentice", 1, "meadow"),
    (400, "apprentice", 2, "meadow"),
    (600, "apprentice", 3, "meadow"),
    (800, "player", 1, "forest"),
    (1000, "player", 2, "forest"),
    (1200, "warrior", 1, "mountain"),
    (1400, "warrior", 2, "mountain"),
    (1600, "knight", 1, "castle"),
    (1800, "knight", 2, "castle"),
    (2000, "master", 1, "tower"),
    (2200, "master", 2, "tower"),
    (2400, "grandmaster", 1, "sky"),
]


def get_rank_for_rating(rating: int) -> dict:
    """Determine rank title and tier for a given rating.

    Args:
        rating: The ELO rating.

    Returns:
        Dict with rank_title, rank_tier, rank_region.
    """
    result = RANK_TIERS[0]
    for entry in RANK_TIERS:
        if rating >= entry[0]:
            result = entry
        else:
            break

    return {
        "rank_title": f"{result[1]}_{result[2]}",
        "rank_tier": result[2],
        "rank_region": result[3],
    }


def update_rating_after_game(
    db: Session,
    user_id: str,
    opponent_rating: int,
    result: float,
    is_ai: bool = True,
    source_id: Optional[str] = None,
) -> tuple[int, int]:
    """Update user rating after a game.

    Args:
        db: Database session.
        user_id: User ID.
        opponent_rating: Opponent (AI) rating.
        result: Actual score (1.0=win, 0.5=draw, 0.0=loss).
        is_ai: Whether opponent is AI.
        source_id: Related game ID.

    Returns:
        Tuple of (new_rating, rating_change).
    """
    # Get or create user rating
    stmt = select(UserRating).where(UserRating.user_id == user_id)
    user_rating = db.execute(stmt).scalar_one_or_none()

    if user_rating is None:
        user_rating = UserRating(
            id=str(uuid.uuid4()),
            user_id=user_id,
            game_rating=300,
            puzzle_rating=300,
            rank_title="apprentice_1",
            rank_tier=1,
            rank_region="meadow",
            xp_total=0,
            xp_today=0,
            coins=0,
        )
        db.add(user_rating)
        db.flush()

    old_rating = user_rating.game_rating or 300

    # Count games played for K-factor
    games_count_stmt = select(func.count()).select_from(Game).where(
        Game.user_id == user_id,
        Game.status == "completed",
    )
    games_played = db.execute(games_count_stmt).scalar() or 0

    # Calculate new rating
    new_rating, change = calculate_new_rating(
        player_rating=old_rating,
        opponent_rating=opponent_rating,
        actual_score=result,
        games_played=games_played,
    )

    # Update user_ratings
    user_rating.game_rating = new_rating
    rank_info = get_rank_for_rating(new_rating)
    user_rating.rank_title = rank_info["rank_title"]
    user_rating.rank_tier = rank_info["rank_tier"]
    user_rating.rank_region = rank_info["rank_region"]
    db.add(user_rating)

    # Insert rating history
    history = RatingHistory(
        id=str(uuid.uuid4()),
        user_id=user_id,
        rating_type="game",
        old_rating=old_rating,
        new_rating=new_rating,
        change_amount=change,
        source_type="ai_game" if is_ai else "pvp_game",
        source_id=source_id,
    )
    db.add(history)
    db.flush()

    return new_rating, change


# ── XP & Level system ────────────────────────────────────────────

XP_PER_LEVEL = 200  # XP needed per level


def get_level_for_xp(xp_total: int) -> tuple[int, int]:
    """Return (level, xp_to_next_level) given total XP."""
    level = xp_total // XP_PER_LEVEL + 1
    xp_in_current = xp_total % XP_PER_LEVEL
    xp_to_next = XP_PER_LEVEL - xp_in_current
    return level, xp_to_next


def award_xp(db: Session, user_id: str, amount: int, reason: str = "") -> int:
    """Award XP to a user. Returns new total XP."""
    user_rating = db.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    ).scalar_one_or_none()

    if user_rating is None:
        user_rating = UserRating(
            id=str(uuid.uuid4()),
            user_id=user_id,
            game_rating=300,
            puzzle_rating=300,
            rank_title="apprentice_1",
            rank_tier=1,
            rank_region="meadow",
            xp_total=0,
            xp_today=0,
            coins=0,
        )
        db.add(user_rating)
        db.flush()

    user_rating.xp_total = (user_rating.xp_total or 0) + amount
    user_rating.xp_today = (user_rating.xp_today or 0) + amount
    db.add(user_rating)
    db.flush()
    return user_rating.xp_total


def get_xp_info(db: Session, user_id: str) -> dict:
    """Get XP, level, and coin info."""
    user_rating = db.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    ).scalar_one_or_none()

    if user_rating is None:
        return {
            "xp_total": 0,
            "xp_today": 0,
            "level": 1,
            "xp_to_next_level": XP_PER_LEVEL,
            "coins": 0,
        }

    level, xp_to_next = get_level_for_xp(user_rating.xp_total)
    return {
        "xp_total": user_rating.xp_total,
        "xp_today": user_rating.xp_today,
        "level": level,
        "xp_to_next_level": xp_to_next,
        "coins": user_rating.coins,
    }


def get_rank_info(db: Session, user_id: str) -> dict:
    """Get rank info with recent rating history."""
    user_rating = db.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    ).scalar_one_or_none()

    game_rating = user_rating.game_rating if user_rating else 300
    puzzle_rating = user_rating.puzzle_rating if user_rating else 300
    rank_title = user_rating.rank_title if user_rating else "apprentice_1"
    rank_tier = user_rating.rank_tier if user_rating else 1
    rank_region = user_rating.rank_region if user_rating else "meadow"

    # Recent history (last 20 entries)
    history_stmt = (
        select(RatingHistory)
        .where(RatingHistory.user_id == user_id)
        .order_by(RatingHistory.created_at.desc())
        .limit(20)
    )
    histories = db.execute(history_stmt).scalars().all()

    history_list = []
    for h in histories:
        history_list.append({
            "rating_type": h.rating_type,
            "old_rating": h.old_rating,
            "new_rating": h.new_rating,
            "change_amount": h.change_amount,
            "source_type": h.source_type,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        })

    return {
        "game_rating": game_rating,
        "puzzle_rating": puzzle_rating,
        "rank_title": rank_title,
        "rank_tier": rank_tier,
        "rank_region": rank_region,
        "history": history_list,
    }


# ── Streak management ────────────────────────────────────────────


def update_streak(db: Session, user_id: str) -> None:
    """Update login streak for the user."""
    today = date.today()
    streak = db.execute(
        select(UserStreak).where(UserStreak.user_id == user_id)
    ).scalar_one_or_none()

    if streak is None:
        streak = UserStreak(
            id=str(uuid.uuid4()),
            user_id=user_id,
        )
        db.add(streak)
        db.flush()

    last = streak.last_login_date
    if last == today:
        return

    if last == today - timedelta(days=1):
        streak.login_streak += 1
    else:
        streak.login_streak = 1

    streak.last_login_date = today
    if streak.login_streak > streak.login_streak_max:
        streak.login_streak_max = streak.login_streak

    db.add(streak)
    db.flush()


# ── Achievement system ───────────────────────────────────────────

# Achievement condition checkers: condition_type -> checker function
# Each checker returns a numeric value that is compared against condition_value


def _check_condition_value(
    db: Session, user_id: str, condition_type: str
) -> int:
    """Evaluate the current value for a given achievement condition type."""

    if condition_type == "games_played":
        stmt = select(func.count()).select_from(Game).where(
            Game.user_id == user_id, Game.status == "completed"
        )
        return db.execute(stmt).scalar() or 0

    elif condition_type == "games_won":
        stmt = select(func.count()).select_from(Game).where(
            Game.user_id == user_id, Game.result == "win"
        )
        return db.execute(stmt).scalar() or 0

    elif condition_type == "puzzles_solved":
        stmt = select(func.count()).select_from(PuzzleAttempt).where(
            PuzzleAttempt.user_id == user_id, PuzzleAttempt.is_correct.is_(True)
        )
        return db.execute(stmt).scalar() or 0

    elif condition_type == "puzzles_attempted":
        stmt = select(func.count()).select_from(PuzzleAttempt).where(
            PuzzleAttempt.user_id == user_id
        )
        return db.execute(stmt).scalar() or 0

    elif condition_type == "train_streak":
        streak = db.execute(
            select(UserStreak).where(UserStreak.user_id == user_id)
        ).scalar_one_or_none()
        return streak.train_streak if streak else 0

    elif condition_type == "login_streak":
        streak = db.execute(
            select(UserStreak).where(UserStreak.user_id == user_id)
        ).scalar_one_or_none()
        return streak.login_streak if streak else 0

    elif condition_type == "total_train_days":
        streak = db.execute(
            select(UserStreak).where(UserStreak.user_id == user_id)
        ).scalar_one_or_none()
        return streak.total_train_days if streak else 0

    elif condition_type == "game_rating":
        ur = db.execute(
            select(UserRating).where(UserRating.user_id == user_id)
        ).scalar_one_or_none()
        return ur.game_rating if ur else 300

    elif condition_type == "puzzle_rating":
        ur = db.execute(
            select(UserRating).where(UserRating.user_id == user_id)
        ).scalar_one_or_none()
        return ur.puzzle_rating if ur else 300

    elif condition_type == "xp_total":
        ur = db.execute(
            select(UserRating).where(UserRating.user_id == user_id)
        ).scalar_one_or_none()
        return ur.xp_total if ur else 0

    return 0


def _batch_check_condition_values(
    db: Session, user_id: str, condition_types: set[str]
) -> dict[str, int]:
    """Pre-fetch all condition values in bulk to reduce per-achievement queries."""
    values: dict[str, int] = {}

    # Batch: game counts
    if condition_types & {"games_played", "games_won"}:
        row = db.execute(
            select(
                func.count().label("played"),
                func.count().filter(Game.result == "win").label("won"),
            )
            .select_from(Game)
            .where(Game.user_id == user_id, Game.status == "completed")
        ).one()
        values["games_played"] = row.played or 0
        values["games_won"] = row.won or 0

    # Batch: puzzle counts
    if condition_types & {"puzzles_solved", "puzzles_attempted"}:
        row = db.execute(
            select(
                func.count().label("attempted"),
                func.count().filter(PuzzleAttempt.is_correct.is_(True)).label("solved"),
            )
            .select_from(PuzzleAttempt)
            .where(PuzzleAttempt.user_id == user_id)
        ).one()
        values["puzzles_attempted"] = row.attempted or 0
        values["puzzles_solved"] = row.solved or 0

    # Batch: streak & train days (single row)
    streak_types = {"train_streak", "login_streak", "total_train_days"}
    if condition_types & streak_types:
        streak = db.execute(
            select(UserStreak).where(UserStreak.user_id == user_id)
        ).scalar_one_or_none()
        values["train_streak"] = streak.train_streak if streak else 0
        values["login_streak"] = streak.login_streak if streak else 0
        values["total_train_days"] = streak.total_train_days if streak else 0

    # Batch: rating & xp (single row)
    rating_types = {"game_rating", "puzzle_rating", "xp_total"}
    if condition_types & rating_types:
        ur = db.execute(
            select(UserRating).where(UserRating.user_id == user_id)
        ).scalar_one_or_none()
        values["game_rating"] = ur.game_rating if ur else 300
        values["puzzle_rating"] = ur.puzzle_rating if ur else 300
        values["xp_total"] = ur.xp_total if ur else 0

    return values


def check_achievements(db: Session, user_id: str) -> list[dict]:
    """Check and unlock any new achievements. Returns list of newly unlocked.

    Optimised: pre-fetches all condition values in batch queries instead of
    issuing one query per achievement.
    """
    # Get all achievements
    all_ach = db.execute(select(Achievement).order_by(Achievement.sort_order)).scalars().all()

    # Get already unlocked
    unlocked_stmt = select(UserAchievement.achievement_id).where(
        UserAchievement.user_id == user_id
    )
    unlocked_ids = set(db.execute(unlocked_stmt).scalars().all())

    # Determine which condition types we actually need to evaluate
    pending_types: set[str] = set()
    for ach in all_ach:
        if ach.id not in unlocked_ids:
            pending_types.add(ach.condition_type)

    if not pending_types:
        return []

    # Batch-fetch all condition values
    condition_values = _batch_check_condition_values(db, user_id, pending_types)

    newly_unlocked = []

    # Pre-fetch UserRating once for coin awards
    ur = db.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    ).scalar_one_or_none()

    for ach in all_ach:
        if ach.id in unlocked_ids:
            continue

        current_val = condition_values.get(ach.condition_type, 0)
        if current_val >= ach.condition_value:
            # Unlock
            ua = UserAchievement(
                id=str(uuid.uuid4()),
                user_id=user_id,
                achievement_id=ach.id,
            )
            db.add(ua)

            # Award XP and coins
            award_xp(db, user_id, ach.xp_reward, reason=f"achievement:{ach.slug}")

            if ur:
                ur.coins += ach.coin_reward
                db.add(ur)

            newly_unlocked.append({
                "id": ach.id,
                "slug": ach.slug,
                "name": ach.name,
                "description": ach.description,
                "icon_key": ach.icon_key,
                "category": ach.category,
                "condition_type": ach.condition_type,
                "condition_value": ach.condition_value,
                "xp_reward": ach.xp_reward,
                "coin_reward": ach.coin_reward,
                "rarity": ach.rarity,
                "achieved": True,
                "achieved_at": datetime.now(timezone.utc),
            })

    db.flush()

    return newly_unlocked


def get_achievements_with_status(db: Session, user_id: str) -> dict:
    """Get all achievements with user's unlock status."""
    all_ach = db.execute(select(Achievement).order_by(Achievement.sort_order)).scalars().all()

    unlocked_stmt = select(UserAchievement).where(UserAchievement.user_id == user_id)
    unlocked = db.execute(unlocked_stmt).scalars().all()
    unlocked_map = {ua.achievement_id: ua for ua in unlocked}

    items = []
    unlocked_count = 0
    for ach in all_ach:
        ua = unlocked_map.get(ach.id)
        achieved = ua is not None
        if achieved:
            unlocked_count += 1
        items.append({
            "id": ach.id,
            "slug": ach.slug,
            "name": ach.name,
            "description": ach.description,
            "icon_key": ach.icon_key,
            "category": ach.category,
            "condition_type": ach.condition_type,
            "condition_value": ach.condition_value,
            "xp_reward": ach.xp_reward,
            "coin_reward": ach.coin_reward,
            "rarity": ach.rarity,
            "achieved": achieved,
            "achieved_at": ua.achieved_at if ua else None,
        })

    return {
        "achievements": items,
        "unlocked_count": unlocked_count,
        "total_count": len(all_ach),
    }
