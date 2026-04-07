"""Membership service layer (B1-9 & B1-10)."""

import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.membership import UserDailyQuota
from app.models.user import User

# ── Tier feature configuration ────────────────────────────────────
# -1 means unlimited

# 当前阶段：全部放开，后续重新设计会员体系后在此配置
# -1 means unlimited
TIER_FEATURES = {
    "free": {
        "daily_games": -1,
        "daily_puzzles": -1,
        "course_level_max": -1,
        "hints_per_game": -1,
        "ai_qa_daily": -1,
    },
    "basic": {
        "daily_games": -1,
        "daily_puzzles": -1,
        "course_level_max": -1,
        "hints_per_game": -1,
        "ai_qa_daily": -1,
    },
    "premium": {
        "daily_games": -1,
        "daily_puzzles": -1,
        "course_level_max": -1,
        "hints_per_game": -1,
        "ai_qa_daily": -1,
    },
}

# Map quota_type to the column name in UserDailyQuota
QUOTA_COLUMN_MAP = {
    "daily_games": "games_played",
    "daily_puzzles": "puzzles_solved",
    "ai_qa_daily": "ai_qa_count",
}


def _get_user_tier(db: Session, user_id: str) -> str:
    """Get user's membership tier. Admin users always get premium."""
    stmt = select(User.membership_tier, User.membership_expires_at, User.role).where(
        User.id == user_id
    )
    row = db.execute(stmt).one_or_none()
    if row is None:
        return "free"

    tier, expires_at, role = row

    # Admin always has full access
    if role == "admin":
        return "premium"
    if tier != "free" and expires_at is not None:
        if expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            return "free"
    return tier or "free"


def check_feature_access(db: Session, user_id: str, feature_name: str) -> bool:
    """Check if user's membership tier has access to a feature.

    Args:
        db: Database session.
        user_id: User ID.
        feature_name: Feature key (e.g. 'daily_games', 'course_level_max').

    Returns:
        True if the user has access.
    """
    tier = _get_user_tier(db, user_id)
    features = TIER_FEATURES.get(tier, TIER_FEATURES["free"])
    value = features.get(feature_name)
    if value is None:
        return False
    # For boolean-like features: -1 or > 0 means access
    return value != 0


def get_daily_quota(
    db: Session,
    user_id: str,
    quota_type: str,
    target_date: Optional[date] = None,
) -> dict:
    """Get user's daily quota usage and limit.

    Args:
        db: Database session.
        user_id: User ID.
        quota_type: One of 'daily_games', 'daily_puzzles', 'ai_qa_daily'.
        target_date: The date to check (defaults to today).

    Returns:
        Dict with used, limit, remaining.
    """
    if target_date is None:
        target_date = date.today()

    tier = _get_user_tier(db, user_id)
    features = TIER_FEATURES.get(tier, TIER_FEATURES["free"])
    limit = features.get(quota_type, 0)

    column_name = QUOTA_COLUMN_MAP.get(quota_type)
    if column_name is None:
        return {"used": 0, "limit": limit, "remaining": limit}

    stmt = select(UserDailyQuota).where(
        UserDailyQuota.user_id == user_id,
        UserDailyQuota.quota_date == target_date,
    )
    quota = db.execute(stmt).scalar_one_or_none()

    used = getattr(quota, column_name, 0) if quota else 0

    if limit == -1:
        remaining = -1  # unlimited
    else:
        remaining = max(0, limit - used)

    return {"used": used, "limit": limit, "remaining": remaining}


def consume_quota(
    db: Session,
    user_id: str,
    quota_type: str,
) -> bool:
    """Consume one unit of a daily quota.

    Args:
        db: Database session.
        user_id: User ID.
        quota_type: One of 'daily_games', 'daily_puzzles', 'ai_qa_daily'.

    Returns:
        True if successfully consumed, False if over limit.
    """
    today = date.today()
    info = get_daily_quota(db, user_id, quota_type, today)

    # -1 means unlimited
    if info["limit"] != -1 and info["remaining"] <= 0:
        return False

    column_name = QUOTA_COLUMN_MAP.get(quota_type)
    if column_name is None:
        return False

    # Get or create daily quota record
    stmt = select(UserDailyQuota).where(
        UserDailyQuota.user_id == user_id,
        UserDailyQuota.quota_date == today,
    )
    quota = db.execute(stmt).scalar_one_or_none()

    if quota is None:
        quota = UserDailyQuota(
            id=str(uuid.uuid4()),
            user_id=user_id,
            quota_date=today,
        )
        db.add(quota)
        db.flush()

    current = getattr(quota, column_name, 0)
    setattr(quota, column_name, current + 1)
    db.add(quota)
    db.flush()

    return True
