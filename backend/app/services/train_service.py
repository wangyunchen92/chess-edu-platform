"""Training service layer (B2-6 & B2-7)."""

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.gamification import UserStreak
from app.models.train import DailyTrainPlan, DailyTrainRecord

# Standard daily training template
STANDARD_TEMPLATE = [
    {
        "item_type": "puzzle",
        "title": "战术热身",
        "description": "完成5道战术谜题",
        "estimated_minutes": 10,
        "link": "/puzzles/daily",
    },
    {
        "item_type": "lesson",
        "title": "继续学习",
        "description": "学习一个新的课时",
        "estimated_minutes": 10,
        "link": "/learn/courses",
    },
    {
        "item_type": "game",
        "title": "实战对弈",
        "description": "与AI对手下一局棋",
        "estimated_minutes": 15,
        "link": "/play/characters",
    },
]


def get_or_create_today_plan(db: Session, user_id: str) -> dict:
    """Get today's training plan, creating one if it doesn't exist."""
    today = date.today()

    stmt = select(DailyTrainPlan).where(
        DailyTrainPlan.user_id == user_id,
        DailyTrainPlan.plan_date == today,
    )
    plan = db.execute(stmt).scalar_one_or_none()

    if plan is None:
        items_data = []
        for i, tpl in enumerate(STANDARD_TEMPLATE):
            items_data.append({
                "index": i,
                "item_type": tpl["item_type"],
                "title": tpl["title"],
                "description": tpl["description"],
                "estimated_minutes": tpl["estimated_minutes"],
                "is_completed": False,
                "link": tpl.get("link"),
            })

        plan = DailyTrainPlan(
            id=str(uuid.uuid4()),
            user_id=user_id,
            plan_date=today,
            template_type="standard",
            items=items_data,
            total_items=len(items_data),
            completed_items=0,
            is_completed=False,
            total_minutes=sum(t["estimated_minutes"] for t in STANDARD_TEMPLATE),
        )
        db.add(plan)
        db.flush()

    return _plan_to_dict(plan)


def complete_plan_item(db: Session, user_id: str, item_index: int) -> dict:
    """Mark a training plan item as completed."""
    today = date.today()

    stmt = select(DailyTrainPlan).where(
        DailyTrainPlan.user_id == user_id,
        DailyTrainPlan.plan_date == today,
    )
    plan = db.execute(stmt).scalar_one_or_none()
    if plan is None:
        raise ValueError("No training plan for today")

    items = list(plan.items)  # JSON list
    if item_index < 0 or item_index >= len(items):
        raise ValueError("Invalid item index")

    if items[item_index].get("is_completed"):
        # Already completed
        return {
            "item_index": item_index,
            "is_completed": True,
            "plan_completed": plan.is_completed,
            "xp_earned": 0,
        }

    items[item_index]["is_completed"] = True
    plan.items = items
    plan.completed_items = sum(1 for it in items if it.get("is_completed"))
    plan.is_completed = plan.completed_items >= plan.total_items

    # Create a record
    record = DailyTrainRecord(
        id=str(uuid.uuid4()),
        user_id=user_id,
        plan_id=plan.id,
        item_index=item_index,
        item_type=items[item_index]["item_type"],
        completed_at=datetime.now(timezone.utc),
    )
    db.add(record)

    xp_earned = 15
    plan.xp_earned = (plan.xp_earned or 0) + xp_earned

    # If plan fully completed, update streak
    if plan.is_completed:
        _update_train_streak(db, user_id)
        xp_earned += 20  # Bonus for completing daily plan

    db.add(plan)
    db.flush()

    return {
        "item_index": item_index,
        "is_completed": True,
        "plan_completed": plan.is_completed,
        "xp_earned": xp_earned,
    }


def get_train_stats(db: Session, user_id: str) -> dict:
    """Get training statistics."""
    streak = db.execute(
        select(UserStreak).where(UserStreak.user_id == user_id)
    ).scalar_one_or_none()

    train_streak = streak.train_streak if streak else 0
    train_streak_max = streak.train_streak_max if streak else 0
    total_train_days = streak.total_train_days if streak else 0

    # This week: count completed plans
    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday
    week_stmt = select(func.count()).select_from(DailyTrainPlan).where(
        DailyTrainPlan.user_id == user_id,
        DailyTrainPlan.plan_date >= week_start,
        DailyTrainPlan.plan_date <= today,
        DailyTrainPlan.is_completed.is_(True),
    )
    week_completed = db.execute(week_stmt).scalar() or 0

    # Today completed?
    today_stmt = select(DailyTrainPlan).where(
        DailyTrainPlan.user_id == user_id,
        DailyTrainPlan.plan_date == today,
    )
    today_plan = db.execute(today_stmt).scalar_one_or_none()
    today_completed = today_plan.is_completed if today_plan else False

    # Recent 7 days training summary
    seven_days_ago = today - timedelta(days=6)
    recent_stmt = (
        select(DailyTrainPlan)
        .where(
            DailyTrainPlan.user_id == user_id,
            DailyTrainPlan.plan_date >= seven_days_ago,
            DailyTrainPlan.plan_date <= today,
        )
        .order_by(DailyTrainPlan.plan_date)
    )
    recent_plans = db.execute(recent_stmt).scalars().all()
    plan_map = {p.plan_date: p for p in recent_plans}

    recent_days = []
    for i in range(7):
        d = seven_days_ago + timedelta(days=i)
        plan = plan_map.get(d)
        recent_days.append({
            "date": d.isoformat(),
            "completed_items": plan.completed_items if plan else 0,
            "total_items": plan.total_items if plan else 0,
            "is_completed": plan.is_completed if plan else False,
        })

    return {
        "train_streak": train_streak,
        "train_streak_max": train_streak_max,
        "total_train_days": total_train_days,
        "this_week_completed": week_completed,
        "this_week_total": 7,
        "today_completed": today_completed,
        "recent_days": recent_days,
    }


def get_streak_info(db: Session, user_id: str) -> dict:
    """Get streak info."""
    streak = db.execute(
        select(UserStreak).where(UserStreak.user_id == user_id)
    ).scalar_one_or_none()

    if streak is None:
        return {
            "login_streak": 0,
            "login_streak_max": 0,
            "train_streak": 0,
            "train_streak_max": 0,
            "total_train_days": 0,
            "last_train_date": None,
        }

    return {
        "login_streak": streak.login_streak,
        "login_streak_max": streak.login_streak_max,
        "train_streak": streak.train_streak,
        "train_streak_max": streak.train_streak_max,
        "total_train_days": streak.total_train_days,
        "last_train_date": streak.last_train_date,
    }


def _update_train_streak(db: Session, user_id: str) -> None:
    """Update the user's training streak when a daily plan is completed."""
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

    last = streak.last_train_date
    if last == today:
        return  # Already updated today

    if last == today - timedelta(days=1):
        streak.train_streak += 1
    else:
        streak.train_streak = 1

    streak.last_train_date = today
    streak.total_train_days += 1

    if streak.train_streak > streak.train_streak_max:
        streak.train_streak_max = streak.train_streak

    db.add(streak)
    db.flush()


def _plan_to_dict(plan: DailyTrainPlan) -> dict:
    """Convert plan ORM to dict."""
    items = plan.items or []
    return {
        "plan_id": plan.id,
        "plan_date": plan.plan_date,
        "template_type": plan.template_type,
        "items": items,
        "total_items": plan.total_items,
        "completed_items": plan.completed_items,
        "is_completed": plan.is_completed,
        "total_minutes": plan.total_minutes,
        "xp_earned": plan.xp_earned,
    }
