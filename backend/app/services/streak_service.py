"""Daily activity streak maintenance with in-process cache.

Called from get_current_user on every authenticated request.
Uses a module-level dict to skip same-day writes. Never raises —
any error is logged and swallowed so the caller's request is not
affected.
"""
import logging
import uuid
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.gamification import UserStreak

logger = logging.getLogger(__name__)

# Module-level in-process cache: user_id -> last touched date.
# Cleared on process restart (that's fine — worst case one extra
# SELECT + no-op per user on the first post-restart request).
_touch_cache: dict[str, date] = {}


def touch_activity(db: Session, user_id: Optional[str]) -> None:
    """Mark a user active today; advance login streak if appropriate.

    Behavior:
    - Same-day cache hit: instant return, no DB access.
    - Cache miss: SELECT, apply streak rules (new/same/consecutive/gap), commit.
    - On any exception: log warning and return. Do NOT update cache
      on failure so the next request retries.

    Args:
        db: SQLAlchemy Session (sync).
        user_id: The authenticated user's id (from JWT sub). May be None/empty
                 in pathological cases — we handle that defensively.
    """
    if not user_id:
        return

    today = date.today()
    cached = _touch_cache.get(user_id)
    if cached == today:
        return  # same-day fast path, no DB access

    try:
        streak = db.execute(
            select(UserStreak).where(UserStreak.user_id == user_id)
        ).scalar_one_or_none()

        if streak is None:
            streak = UserStreak(
                id=str(uuid.uuid4()),
                user_id=user_id,
                login_streak=1,
                login_streak_max=1,
                last_login_date=today,
            )
            db.add(streak)
        elif streak.last_login_date == today:
            # DB already has today — the cache was just stale
            pass
        elif streak.last_login_date == today - timedelta(days=1):
            streak.login_streak += 1
            if streak.login_streak > streak.login_streak_max:
                streak.login_streak_max = streak.login_streak
            streak.last_login_date = today
        else:
            # gap of ≥2 days OR last_login_date is None — reset
            streak.login_streak = 1
            streak.last_login_date = today

        db.commit()
        _touch_cache[user_id] = today
    except Exception as e:
        logger.warning("touch_activity failed for user %s: %s", user_id, e)
        # Do NOT update _touch_cache so the next request retries
