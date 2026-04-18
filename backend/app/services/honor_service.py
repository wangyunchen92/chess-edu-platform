"""Honor record service — competition honors & milestone checks."""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.game import Game
from app.models.gamification import UserRating, UserStreak
from app.models.honor import HonorRecord
from app.models.puzzle import PuzzleAttempt
from app.models.user import User

logger = logging.getLogger("chess_edu.honor")

# ── Milestone definitions ────────────────────────────────────────

MILESTONE_DEFINITIONS: List[Dict[str, Any]] = [
    # game_rating milestones
    {"key": "game_rating_500",  "title": "对弈评分突破500",  "category": "game_rating",  "target": 500},
    {"key": "game_rating_800",  "title": "对弈评分突破800",  "category": "game_rating",  "target": 800},
    {"key": "game_rating_1000", "title": "对弈评分突破1000", "category": "game_rating",  "target": 1000},
    {"key": "game_rating_1200", "title": "对弈评分突破1200", "category": "game_rating",  "target": 1200},
    {"key": "game_rating_1500", "title": "对弈评分突破1500", "category": "game_rating",  "target": 1500},
    # puzzle_rating milestones
    {"key": "puzzle_rating_500",  "title": "谜题评分突破500",  "category": "puzzle_rating", "target": 500},
    {"key": "puzzle_rating_800",  "title": "谜题评分突破800",  "category": "puzzle_rating", "target": 800},
    {"key": "puzzle_rating_1000", "title": "谜题评分突破1000", "category": "puzzle_rating", "target": 1000},
    {"key": "puzzle_rating_1200", "title": "谜题评分突破1200", "category": "puzzle_rating", "target": 1200},
    {"key": "puzzle_rating_1500", "title": "谜题评分突破1500", "category": "puzzle_rating", "target": 1500},
    # games count milestones
    {"key": "games_10",  "title": "完成10局对弈",   "category": "games", "target": 10},
    {"key": "games_50",  "title": "完成50局对弈",   "category": "games", "target": 50},
    {"key": "games_100", "title": "完成100局对弈",  "category": "games", "target": 100},
    {"key": "games_500", "title": "完成500局对弈",  "category": "games", "target": 500},
    # puzzles count milestones
    {"key": "puzzles_50",   "title": "解对50道谜题",   "category": "puzzles", "target": 50},
    {"key": "puzzles_200",  "title": "解对200道谜题",  "category": "puzzles", "target": 200},
    {"key": "puzzles_500",  "title": "解对500道谜题",  "category": "puzzles", "target": 500},
    {"key": "puzzles_1000", "title": "解对1000道谜题", "category": "puzzles", "target": 1000},
    # win_streak milestones
    {"key": "win_streak_3",  "title": "连胜3局",  "category": "win_streak",  "target": 3},
    {"key": "win_streak_5",  "title": "连胜5局",  "category": "win_streak",  "target": 5},
    {"key": "win_streak_10", "title": "连胜10局", "category": "win_streak",  "target": 10},
    # train_streak milestones
    {"key": "train_streak_7",   "title": "连续训练7天",   "category": "train_streak", "target": 7},
    {"key": "train_streak_30",  "title": "连续训练30天",  "category": "train_streak", "target": 30},
    {"key": "train_streak_100", "title": "连续训练100天", "category": "train_streak", "target": 100},
]

# Map category -> list of contexts that trigger it
_CATEGORY_CONTEXTS = {
    "game_rating": ["game", "all"],
    "puzzle_rating": ["puzzle", "all"],
    "games": ["game", "all"],
    "puzzles": ["puzzle", "all"],
    "win_streak": ["game", "all"],
    "train_streak": ["train", "all"],
}


def _get_current_values(db: Session, user_id: str) -> Dict[str, int]:
    """Fetch all current metric values for a user."""
    values: Dict[str, int] = {}

    # Ratings
    rating_row = db.execute(
        select(UserRating.game_rating, UserRating.puzzle_rating)
        .where(UserRating.user_id == user_id)
    ).first()
    values["game_rating"] = rating_row.game_rating if rating_row else 300
    values["puzzle_rating"] = rating_row.puzzle_rating if rating_row else 300

    # Finished games count
    game_count = db.execute(
        select(func.count()).select_from(Game)
        .where(Game.user_id == user_id, Game.status == "finished")
    ).scalar() or 0
    values["games"] = game_count

    # Correct puzzle attempts count
    puzzle_count = db.execute(
        select(func.count()).select_from(PuzzleAttempt)
        .where(PuzzleAttempt.user_id == user_id, PuzzleAttempt.is_correct.is_(True))
    ).scalar() or 0
    values["puzzles"] = puzzle_count

    # Train streak
    streak_row = db.execute(
        select(UserStreak.train_streak)
        .where(UserStreak.user_id == user_id)
    ).first()
    values["train_streak"] = streak_row.train_streak if streak_row else 0

    # Win streak — count consecutive recent wins
    recent_games = db.execute(
        select(Game.result)
        .where(Game.user_id == user_id, Game.status == "finished")
        .order_by(desc(Game.ended_at))
        .limit(50)
    ).scalars().all()
    win_streak = 0
    for result in recent_games:
        if result == "win":
            win_streak += 1
        else:
            break
    values["win_streak"] = win_streak

    return values


def check_milestones(db: Session, user_id: str, context: str = "all") -> List[str]:
    """Check and create honor records for newly achieved milestones.

    Returns list of newly achieved milestone keys.
    """
    new_achievements: List[str] = []

    # Get existing milestone keys for this user
    existing_keys = set(
        db.execute(
            select(HonorRecord.milestone_key)
            .where(HonorRecord.user_id == user_id, HonorRecord.type == "milestone")
        ).scalars().all()
    )

    # Get current values
    current_values = _get_current_values(db, user_id)

    for milestone in MILESTONE_DEFINITIONS:
        key = milestone["key"]
        category = milestone["category"]
        target = milestone["target"]

        # Skip if not relevant to this context
        if context not in _CATEGORY_CONTEXTS.get(category, ["all"]):
            continue

        # Skip if already achieved
        if key in existing_keys:
            continue

        # Check if milestone is achieved
        current_val = current_values.get(category, 0)
        if current_val >= target:
            record = HonorRecord(
                id=str(uuid.uuid4()),
                user_id=user_id,
                type="milestone",
                title=milestone["title"],
                milestone_key=key,
                milestone_value=target,
                is_public=False,
            )
            db.add(record)
            new_achievements.append(key)
            logger.info("User %s achieved milestone: %s", user_id, key)

    if new_achievements:
        db.flush()

    return new_achievements


def get_honor_wall(
    db: Session,
    page: int,
    page_size: int,
    competition_name: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """Get public competition honors for the honor wall."""
    base_filter = [
        HonorRecord.type == "competition",
        HonorRecord.is_public.is_(True),
    ]
    if competition_name:
        base_filter.append(HonorRecord.competition_name == competition_name)

    # Total count
    total = db.execute(
        select(func.count()).select_from(HonorRecord).where(*base_filter)
    ).scalar() or 0

    # Items with user info
    stmt = (
        select(HonorRecord, User.nickname, User.avatar_url)
        .join(User, HonorRecord.user_id == User.id)
        .where(*base_filter)
        .order_by(desc(HonorRecord.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = db.execute(stmt).all()

    items = []
    for honor, nickname, avatar_url in rows:
        items.append({
            "id": honor.id,
            "user_nickname": nickname,
            "user_avatar_url": avatar_url,
            "title": honor.title,
            "description": honor.description,
            "rank": honor.rank,
            "competition_name": honor.competition_name,
            "competition_date": honor.competition_date,
            "created_at": honor.created_at,
        })

    return items, total


def get_competition_names(db: Session) -> List[str]:
    """Get distinct competition names from public honors."""
    rows = db.execute(
        select(HonorRecord.competition_name)
        .where(
            HonorRecord.type == "competition",
            HonorRecord.is_public.is_(True),
            HonorRecord.competition_name.isnot(None),
        )
        .distinct()
        .order_by(HonorRecord.competition_name)
    ).scalars().all()
    return list(rows)


def get_my_honors(db: Session, user_id: str) -> Dict[str, Any]:
    """Get a user's competitions and milestones with progress."""
    # Competition honors
    comp_rows = db.execute(
        select(HonorRecord)
        .where(HonorRecord.user_id == user_id, HonorRecord.type == "competition")
        .order_by(desc(HonorRecord.created_at))
    ).scalars().all()

    competitions = []
    for r in comp_rows:
        competitions.append({
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "rank": r.rank,
            "competition_name": r.competition_name,
            "competition_date": r.competition_date,
            "is_public": r.is_public,
            "created_at": r.created_at,
        })

    # Milestones with progress
    achieved_map: Dict[str, HonorRecord] = {}
    milestone_rows = db.execute(
        select(HonorRecord)
        .where(HonorRecord.user_id == user_id, HonorRecord.type == "milestone")
    ).scalars().all()
    for r in milestone_rows:
        if r.milestone_key:
            achieved_map[r.milestone_key] = r

    current_values = _get_current_values(db, user_id)

    milestones = []
    for m in MILESTONE_DEFINITIONS:
        key = m["key"]
        category = m["category"]
        achieved_record = achieved_map.get(key)
        milestones.append({
            "milestone_key": key,
            "title": m["title"],
            "category": category,
            "target_value": m["target"],
            "achieved": achieved_record is not None,
            "achieved_at": achieved_record.created_at if achieved_record else None,
            "current_value": current_values.get(category, 0),
        })

    return {"competitions": competitions, "milestones": milestones}


def get_user_honors(db: Session, user_id: str) -> Dict[str, Any]:
    """Get a user's honors (for teacher/admin view). Same as get_my_honors."""
    return get_my_honors(db, user_id)


def create_competition_honor(
    db: Session,
    user_id: str,
    created_by: str,
    title: str,
    competition_name: str,
    competition_date: Any,
    description: Optional[str] = None,
    rank: Optional[str] = None,
    is_public: bool = True,
) -> HonorRecord:
    """Create a competition honor record."""
    record = HonorRecord(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type="competition",
        title=title,
        description=description,
        rank=rank,
        competition_name=competition_name,
        competition_date=competition_date,
        is_public=is_public,
        created_by=created_by,
    )
    db.add(record)
    db.flush()
    return record


def update_competition_honor(
    db: Session,
    record_id: str,
    current_user_id: str,
    current_role: str,
    **kwargs: Any,
) -> Optional[HonorRecord]:
    """Update a competition honor. Only creator or admin can update."""
    record = db.execute(
        select(HonorRecord).where(HonorRecord.id == record_id)
    ).scalar_one_or_none()

    if record is None:
        return None

    if record.type != "competition":
        raise ValueError("Only competition honors can be updated")

    if current_role != "admin" and record.created_by != current_user_id:
        raise PermissionError("Only the creator or admin can update this record")

    for field, value in kwargs.items():
        if value is not None and hasattr(record, field):
            setattr(record, field, value)

    db.flush()
    return record


def delete_competition_honor(
    db: Session,
    record_id: str,
    current_user_id: str,
    current_role: str,
) -> bool:
    """Delete a competition honor. Only creator or admin can delete."""
    record = db.execute(
        select(HonorRecord).where(HonorRecord.id == record_id)
    ).scalar_one_or_none()

    if record is None:
        return False

    if record.type != "competition":
        raise ValueError("Only competition honors can be deleted")

    if current_role != "admin" and record.created_by != current_user_id:
        raise PermissionError("Only the creator or admin can delete this record")

    db.delete(record)
    db.flush()
    return True
