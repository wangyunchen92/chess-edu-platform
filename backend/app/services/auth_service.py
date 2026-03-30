"""Authentication service layer."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)


def authenticate_user(
    db: Session,
    username: str,
    password: str,
) -> Optional[User]:
    """Authenticate a user by username and password.

    Args:
        db: Database session.
        username: The username to look up.
        password: The plain text password to verify.

    Returns:
        The User object if credentials are valid, None otherwise.
    """
    stmt = select(User).where(User.username == username)
    result = db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        return None

    if not verify_password(password, user.password_hash):
        return None

    if user.status != "active":
        return None

    return user


def create_tokens(user: User) -> dict[str, str]:
    """Create access and refresh token pair for a user.

    Args:
        user: The authenticated User object.

    Returns:
        Dict with access_token, refresh_token, and token_type.
    """
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
    }

    access_token = create_access_token(payload)
    refresh_token = create_refresh_token(payload)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


def refresh_tokens(refresh_token_str: str) -> Optional[dict[str, str]]:
    """Validate a refresh token and issue new token pair.

    Args:
        refresh_token_str: The refresh token to validate.

    Returns:
        Dict with new access_token, refresh_token, and token_type, or None if invalid.
    """
    payload = decode_token(refresh_token_str)
    if payload is None:
        return None

    if payload.get("type") != "refresh":
        return None

    new_payload = {
        "sub": payload.get("sub"),
        "username": payload.get("username"),
        "role": payload.get("role"),
    }

    access_token = create_access_token(new_payload)
    new_refresh_token = create_refresh_token(new_payload)

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


def update_login_info(db: Session, user: User) -> None:
    """Update user's login timestamp, count, and login streak.

    Args:
        db: Database session.
        user: The user who just logged in.
    """
    from app.models.gamification import UserStreak
    from sqlalchemy import select
    from datetime import date, timedelta

    user.last_login_at = datetime.now(timezone.utc)
    user.login_count += 1
    db.add(user)

    # Update login streak
    today = date.today()
    streak = db.execute(
        select(UserStreak).where(UserStreak.user_id == str(user.id))
    ).scalar_one_or_none()

    if streak is None:
        import uuid
        streak = UserStreak(
            id=str(uuid.uuid4()),
            user_id=str(user.id),
            login_streak=1,
            login_streak_max=1,
            last_login_date=today,
        )
        db.add(streak)
    else:
        if streak.last_login_date == today:
            # Already logged in today, no change
            pass
        elif streak.last_login_date == today - timedelta(days=1):
            # Consecutive day — increment streak
            streak.login_streak += 1
            if streak.login_streak > streak.login_streak_max:
                streak.login_streak_max = streak.login_streak
            streak.last_login_date = today
            db.add(streak)
        else:
            # Streak broken — reset to 1
            streak.login_streak = 1
            streak.last_login_date = today
            db.add(streak)
