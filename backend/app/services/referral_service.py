"""Referral (分享有礼) service layer."""

import random
import string
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.credit_service import add_credits

# Exclude ambiguous characters: 0, O, 1, I, L
_ALPHABET = "".join(
    c for c in string.ascii_uppercase + string.digits
    if c not in "0O1IL"
)

_CODE_LENGTH = 6
_REFERRAL_REWARD = 100


def generate_referral_code(db: Session, user_id: str) -> str:
    """Generate a unique 6-char referral code for the user.

    The code uses uppercase letters + digits, excluding ambiguous
    characters (0/O/1/I/L).

    Args:
        db: Database session.
        user_id: The user to generate a code for.

    Returns:
        The generated referral code.

    Raises:
        ValueError: If the user does not exist.
    """
    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()

    if user is None:
        raise ValueError("用户不存在")

    # Try generating a unique code (collision is extremely unlikely with 30^6 = 729M combinations)
    for _ in range(10):
        code = "".join(random.choices(_ALPHABET, k=_CODE_LENGTH))
        existing = db.execute(
            select(User.id).where(User.referral_code == code)
        ).scalar_one_or_none()
        if existing is None:
            user.referral_code = code
            db.add(user)
            db.flush()
            return code

    raise RuntimeError("无法生成唯一推荐码，请重试")


def get_or_create_referral_code(db: Session, user_id: str) -> str:
    """Return existing referral code or generate a new one.

    Args:
        db: Database session.
        user_id: The user ID.

    Returns:
        The user's referral code.
    """
    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()

    if user is None:
        raise ValueError("用户不存在")

    if user.referral_code:
        return user.referral_code

    return generate_referral_code(db, user_id)


def get_referral_stats(db: Session, user_id: str) -> dict:
    """Get referral statistics for a user.

    Args:
        db: Database session.
        user_id: The user ID.

    Returns:
        Dict with ``code`` and ``invited_count``.
    """
    code = get_or_create_referral_code(db, user_id)

    invited_count = db.execute(
        select(func.count()).select_from(User).where(User.referred_by == user_id)
    ).scalar() or 0

    return {
        "code": code,
        "invited_count": invited_count,
    }


def process_referral(
    db: Session,
    new_user_id: str,
    referral_code: str,
) -> bool:
    """Process a referral: link the new user to the inviter and grant rewards.

    Anti-abuse checks:
    - referral_code must be valid (belong to an existing user)
    - inviter must not be the same as the new user

    Args:
        db: Database session.
        new_user_id: The newly registered user's ID.
        referral_code: The referral code provided during registration.

    Returns:
        True if referral was processed successfully, False otherwise.
    """
    if not referral_code:
        return False

    # Look up inviter by referral code
    inviter = db.execute(
        select(User).where(User.referral_code == referral_code.upper())
    ).scalar_one_or_none()

    if inviter is None:
        return False

    # Anti-abuse: inviter cannot be the new user
    if str(inviter.id) == str(new_user_id):
        return False

    # Link the new user to the inviter
    new_user = db.execute(
        select(User).where(User.id == new_user_id)
    ).scalar_one_or_none()

    if new_user is None:
        return False

    new_user.referred_by = str(inviter.id)
    db.add(new_user)
    db.flush()

    # Grant rewards to both parties
    add_credits(
        db,
        user_id=str(inviter.id),
        amount=_REFERRAL_REWARD,
        tx_type="reward",
        description="邀请好友奖励",
        related_id=new_user_id,
    )

    add_credits(
        db,
        user_id=new_user_id,
        amount=_REFERRAL_REWARD,
        tx_type="reward",
        description="受邀注册奖励",
        related_id=str(inviter.id),
    )

    return True
