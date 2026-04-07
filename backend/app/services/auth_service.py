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


def register_user(
    db: Session,
    phone: str,
    password: str,
    nickname: Optional[str] = None,
    invite_code: str = "",
) -> User:
    """Register a new user by phone number.

    Args:
        db: Database session.
        phone: 11-digit mobile phone number.
        password: Plain text password (will be hashed).
        nickname: Optional display name; defaults to last 4 digits of phone.
        invite_code: Must match REGISTER_INVITE_CODE.

    Returns:
        The newly created User.

    Raises:
        ValueError: If validation fails.
    """
    import re
    import uuid
    from app.config import settings
    from app.models.gamification import UserRating, UserStreak
    from app.models.user import UserProfile
    from app.utils.security import hash_password

    # Validate invite code
    if invite_code != settings.REGISTER_INVITE_CODE:
        raise ValueError("邀请码不正确")

    # Validate phone format
    if not re.match(r"^1\d{10}$", phone):
        raise ValueError("手机号格式不正确")

    # Check phone uniqueness
    existing = db.execute(
        select(User).where(User.phone == phone)
    ).scalar_one_or_none()
    if existing is not None:
        raise ValueError("该手机号已注册")

    # Also check username uniqueness (username = phone)
    existing_username = db.execute(
        select(User).where(User.username == phone)
    ).scalar_one_or_none()
    if existing_username is not None:
        raise ValueError("该手机号已注册")

    display_name = nickname or f"棋手{phone[-4:]}"

    user = User(
        id=str(uuid.uuid4()),
        username=phone,
        phone=phone,
        password_hash=hash_password(password),
        nickname=display_name,
        role="student",
    )
    db.add(user)
    db.flush()

    # Create UserProfile
    from datetime import time as time_type
    profile = UserProfile(
        id=str(uuid.uuid4()),
        user_id=user.id,
        daily_remind_time=time_type(18, 0),
    )
    db.add(profile)

    # Create UserRating
    rating = UserRating(
        id=str(uuid.uuid4()),
        user_id=user.id,
    )
    db.add(rating)

    # Create UserStreak
    streak = UserStreak(
        id=str(uuid.uuid4()),
        user_id=user.id,
    )
    db.add(streak)

    db.flush()
    return user


def change_password(
    db: Session,
    user_id: str,
    old_password: str,
    new_password: str,
) -> None:
    """Change user's password.

    Args:
        db: Database session.
        user_id: ID of the user.
        old_password: Current password for verification.
        new_password: New password to set.

    Raises:
        ValueError: If old password is wrong or user not found.
    """
    from app.utils.security import hash_password, verify_password

    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()

    if user is None:
        raise ValueError("用户不存在")

    if not verify_password(old_password, user.password_hash):
        raise ValueError("旧密码不正确")

    user.password_hash = hash_password(new_password)
    db.add(user)
    db.flush()
