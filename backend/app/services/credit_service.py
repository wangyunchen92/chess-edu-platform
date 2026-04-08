"""Credit system business logic: balance, consume, add, transfer, rewards."""

import logging
from datetime import date, datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.credits import CreditBalance, CreditPackage, CreditTransaction

logger = logging.getLogger("chess_edu.credit_service")

# ---------- constants ----------

CREDIT_COSTS = {
    "theme_puzzle": 20,
    "ai_review": 50,
    "engine_analysis": 20,
    "weakness_diagnosis": 30,
    "ai_teaching": 10,
}

DAILY_REWARDS = {
    "login": 5,
    "training_complete": 10,
    "daily_puzzle_perfect": 15,
    "streak_7_days": 50,
}

_INITIAL_CREDITS = 500

# ---------- hard-coded packages (Phase 1, no payment) ----------

DEFAULT_PACKAGES = [
    {"name": "体验包", "credits": 500, "price_cents": 990, "sort_order": 1},
    {"name": "标准包", "credits": 2000, "price_cents": 2990, "sort_order": 2},
    {"name": "畅学包", "credits": 5000, "price_cents": 5990, "sort_order": 3},
    {"name": "年度包", "credits": 20000, "price_cents": 19900, "sort_order": 4},
]


# ---------- core helpers ----------

def get_or_create_balance(db: Session, user_id: str) -> CreditBalance:
    """Return existing balance or create one with initial credits."""
    bal = db.execute(
        select(CreditBalance).where(CreditBalance.user_id == user_id)
    ).scalar_one_or_none()

    if bal is not None:
        return bal

    bal = CreditBalance(
        user_id=user_id,
        balance=_INITIAL_CREDITS,
        total_earned=_INITIAL_CREDITS,
        total_spent=0,
    )
    db.add(bal)
    db.flush()

    # Record the initial reward transaction
    tx = CreditTransaction(
        user_id=user_id,
        amount=_INITIAL_CREDITS,
        balance_after=_INITIAL_CREDITS,
        type="reward",
        description="新用户注册赠送",
    )
    db.add(tx)
    db.flush()

    logger.info("Created credit balance for user %s (+%d initial)", user_id, _INITIAL_CREDITS)
    return bal


def get_balance(db: Session, user_id: str) -> int:
    """Return current balance (0 if no record)."""
    bal = get_or_create_balance(db, user_id)
    return bal.balance


def consume_credits(
    db: Session,
    user_id: str,
    amount: int,
    description: str,
    related_id: Optional[str] = None,
) -> bool:
    """Deduct credits. Returns True on success, False if insufficient."""
    bal = get_or_create_balance(db, user_id)
    if bal.balance < amount:
        return False

    bal.balance -= amount
    bal.total_spent += amount
    db.flush()

    tx = CreditTransaction(
        user_id=user_id,
        amount=-amount,
        balance_after=bal.balance,
        type="consume",
        description=description,
        related_id=related_id,
    )
    db.add(tx)
    db.flush()
    return True


def add_credits(
    db: Session,
    user_id: str,
    amount: int,
    tx_type: str,
    description: str,
    related_id: Optional[str] = None,
) -> CreditBalance:
    """Add credits (recharge / reward / transfer_in)."""
    bal = get_or_create_balance(db, user_id)
    bal.balance += amount
    bal.total_earned += amount
    db.flush()

    tx = CreditTransaction(
        user_id=user_id,
        amount=amount,
        balance_after=bal.balance,
        type=tx_type,
        description=description,
        related_id=related_id,
    )
    db.add(tx)
    db.flush()
    return bal


def transfer_credits(
    db: Session,
    teacher_id: str,
    student_ids: List[str],
    amount: int,
) -> None:
    """Teacher transfers *amount* credits to each student in *student_ids*.

    Raises ValueError if teacher balance is insufficient.
    """
    total_cost = amount * len(student_ids)
    teacher_bal = get_or_create_balance(db, teacher_id)

    if teacher_bal.balance < total_cost:
        raise ValueError(
            f"积分不足：需要 {total_cost}，当前余额 {teacher_bal.balance}"
        )

    # Deduct from teacher
    teacher_bal.balance -= total_cost
    teacher_bal.total_spent += total_cost
    db.flush()

    tx_teacher = CreditTransaction(
        user_id=teacher_id,
        amount=-total_cost,
        balance_after=teacher_bal.balance,
        type="transfer_out",
        description=f"向 {len(student_ids)} 名学生转赠积分",
    )
    db.add(tx_teacher)

    # Credit each student
    for sid in student_ids:
        add_credits(db, sid, amount, "transfer_in", "老师转赠")

    db.flush()


def get_transactions(
    db: Session,
    user_id: str,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[list, int]:
    """Return (list_of_transactions, total_count) for a user."""
    base = select(CreditTransaction).where(CreditTransaction.user_id == user_id)

    total = db.execute(
        select(func.count()).select_from(base.subquery())
    ).scalar() or 0

    rows = db.execute(
        base.order_by(CreditTransaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return rows, total


def grant_daily_reward(db: Session, user_id: str, reward_type: str) -> int:
    """Grant a daily reward if not already granted today.

    Returns the number of credits granted (0 if already claimed).
    """
    reward_amount = DAILY_REWARDS.get(reward_type)
    if reward_amount is None:
        return 0

    today_start = datetime.combine(date.today(), datetime.min.time()).replace(
        tzinfo=timezone.utc
    )

    # Check if reward already granted today
    existing = db.execute(
        select(CreditTransaction).where(
            CreditTransaction.user_id == user_id,
            CreditTransaction.type == "reward",
            CreditTransaction.description == f"每日奖励:{reward_type}",
            CreditTransaction.created_at >= today_start,
        )
    ).scalar_one_or_none()

    if existing is not None:
        return 0

    add_credits(db, user_id, reward_amount, "reward", f"每日奖励:{reward_type}")
    return reward_amount


# ---------- packages ----------

def get_packages(db: Session) -> list:
    """Return active credit packages (from DB, or fall back to defaults)."""
    rows = db.execute(
        select(CreditPackage)
        .where(CreditPackage.is_active == True)  # noqa: E712
        .order_by(CreditPackage.sort_order)
    ).scalars().all()

    if rows:
        return rows

    # Fall back to hard-coded defaults
    return [
        {
            "id": f"pkg_{i+1}",
            "name": p["name"],
            "credits": p["credits"],
            "price_cents": p["price_cents"],
            "is_active": True,
        }
        for i, p in enumerate(DEFAULT_PACKAGES)
    ]
