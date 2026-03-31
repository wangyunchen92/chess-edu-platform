"""Character unlock and management service (Phase 2a F1)."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.adventure import PromotionChallenge
from app.models.character import Character, UserCharacterRelation
from app.models.course import Course, LessonProgress
from app.models.gamification import UserRating
from app.models.user import User
from app.schemas.play import (
    CheckUnlockResponse,
    UnlockConditionItem,
    UnlockResponse,
    UnlockStoryLine,
)


def _get_affinity_level(affinity: int) -> str:
    """Calculate affinity level from numeric affinity value."""
    if affinity >= 500:
        return "best_friend"
    elif affinity >= 300:
        return "trusted"
    elif affinity >= 150:
        return "familiar"
    elif affinity >= 50:
        return "acquainted"
    return "stranger"


def _check_single_condition(
    db: Session,
    user_id: str,
    condition: dict,
    user_rating_cache: Optional[dict] = None,
) -> UnlockConditionItem:
    """Evaluate a single unlock condition and return its status."""
    cond_type = condition.get("type", "")

    if cond_type == "default":
        return UnlockConditionItem(
            type="default", label="默认解锁", met=True
        )

    elif cond_type == "rating":
        min_rating = condition.get("min_rating", 0)
        current = 300
        if user_rating_cache:
            current = user_rating_cache.get("game_rating", 300)
        else:
            ur = db.execute(
                select(UserRating).where(UserRating.user_id == user_id)
            ).scalar_one_or_none()
            current = ur.game_rating if ur else 300
        return UnlockConditionItem(
            type="rating",
            label=f"对弈Rating >= {min_rating}",
            required=min_rating,
            current=current,
            met=current >= min_rating,
        )

    elif cond_type == "promotion_challenge":
        challenge_type = condition.get("challenge_type", "")
        stmt = select(PromotionChallenge).where(
            PromotionChallenge.user_id == user_id,
            PromotionChallenge.challenge_type == challenge_type,
            PromotionChallenge.status == "passed",
        )
        passed = db.execute(stmt).scalar_one_or_none() is not None
        label_map = {
            "grassland_guardian": "通过「草原守护者之战」",
            "forest_heart": "通过「森林之心」",
        }
        return UnlockConditionItem(
            type="promotion_challenge",
            label=label_map.get(challenge_type, f"通过「{challenge_type}」"),
            required=challenge_type,
            current=challenge_type if passed else None,
            met=passed,
        )

    elif cond_type == "course_lessons":
        course_slug = condition.get("course_slug", "")
        min_lessons = condition.get("min_lessons", 1)
        # Find course
        course = db.execute(
            select(Course).where(Course.slug == course_slug)
        ).scalar_one_or_none()
        completed = 0
        if course:
            stmt = select(LessonProgress).where(
                LessonProgress.user_id == user_id,
                LessonProgress.status == "completed",
            )
            # Filter lessons belonging to this course
            from app.models.course import Lesson
            lesson_ids_stmt = select(Lesson.id).where(Lesson.course_id == course.id)
            lesson_ids = [r[0] for r in db.execute(lesson_ids_stmt).all()]
            if lesson_ids:
                completed_stmt = select(LessonProgress).where(
                    LessonProgress.user_id == user_id,
                    LessonProgress.lesson_id.in_(lesson_ids),
                    LessonProgress.status == "completed",
                )
                completed = len(db.execute(completed_stmt).scalars().all())
        return UnlockConditionItem(
            type="course_lessons",
            label=f"完成 {course_slug} 前{min_lessons}课",
            required=min_lessons,
            current=completed,
            met=completed >= min_lessons,
        )

    elif cond_type == "games_played":
        min_count = condition.get("min_count", 1)
        from app.models.game import Game
        from sqlalchemy import func as sqlfunc
        count = db.execute(
            select(sqlfunc.count()).select_from(Game).where(
                Game.user_id == user_id,
                Game.status == "completed",
            )
        ).scalar() or 0
        return UnlockConditionItem(
            type="games_played",
            label=f"完成{min_count}场对弈",
            required=min_count,
            current=count,
            met=count >= min_count,
        )

    elif cond_type == "membership":
        min_tier = condition.get("min_tier", "free")
        user = db.execute(
            select(User).where(User.id == user_id)
        ).scalar_one_or_none()
        current_tier = user.membership_tier if user else "free"
        tier_order = {"free": 0, "basic": 1, "premium": 2, "master": 3}
        met = tier_order.get(current_tier, 0) >= tier_order.get(min_tier, 0)
        return UnlockConditionItem(
            type="membership",
            label=f"会员等级 >= {min_tier}",
            required=min_tier,
            current=current_tier,
            met=met,
        )

    # Unknown condition type
    return UnlockConditionItem(
        type=cond_type,
        label=f"未知条件: {cond_type}",
        met=False,
    )


def check_unlock(
    db: Session, character_id: str, user_id: str
) -> CheckUnlockResponse:
    """Check unlock conditions for a character (read-only)."""
    char = db.execute(
        select(Character).where(Character.id == character_id)
    ).scalar_one_or_none()
    if char is None:
        return CheckUnlockResponse(
            character_id=character_id,
            character_name="",
            is_unlocked=False,
            conditions=[],
        )

    # Already unlocked?
    rel = db.execute(
        select(UserCharacterRelation).where(
            UserCharacterRelation.user_id == user_id,
            UserCharacterRelation.character_id == character_id,
        )
    ).scalar_one_or_none()

    if char.is_free or (rel and rel.is_unlocked):
        return CheckUnlockResponse(
            character_id=character_id,
            character_name=char.name,
            is_unlocked=True,
            conditions=[],
        )

    # Evaluate conditions
    unlock_cond = char.unlock_condition or {}
    conditions = []

    if unlock_cond.get("type") == "default":
        return CheckUnlockResponse(
            character_id=character_id,
            character_name=char.name,
            is_unlocked=True,
            conditions=[],
        )
    elif unlock_cond.get("type") == "multi":
        for cond in unlock_cond.get("conditions", []):
            conditions.append(_check_single_condition(db, user_id, cond))
    else:
        conditions.append(_check_single_condition(db, user_id, unlock_cond))

    all_met = all(c.met for c in conditions)
    return CheckUnlockResponse(
        character_id=character_id,
        character_name=char.name,
        is_unlocked=all_met,
        conditions=conditions,
    )


def unlock_character(
    db: Session, character_id: str, user_id: str
) -> UnlockResponse:
    """Attempt to unlock a character. If conditions are met, performs the unlock."""
    check_result = check_unlock(db, character_id, user_id)

    char = db.execute(
        select(Character).where(Character.id == character_id)
    ).scalar_one_or_none()

    if char is None:
        return UnlockResponse(
            character_id=character_id,
            unlocked=False,
            missing_conditions=[],
        )

    # Already unlocked
    rel = db.execute(
        select(UserCharacterRelation).where(
            UserCharacterRelation.user_id == user_id,
            UserCharacterRelation.character_id == character_id,
        )
    ).scalar_one_or_none()

    if rel and rel.is_unlocked:
        return UnlockResponse(
            character_id=character_id,
            character_name=char.name,
            unlocked=True,
            unlock_story=None,
        )

    if not check_result.is_unlocked:
        missing = [c for c in check_result.conditions if not c.met]
        return UnlockResponse(
            character_id=character_id,
            character_name=char.name,
            unlocked=False,
            missing_conditions=missing,
        )

    # Perform unlock
    if rel is None:
        rel = UserCharacterRelation(
            id=str(uuid.uuid4()),
            user_id=user_id,
            character_id=character_id,
            is_unlocked=True,
            unlocked_at=datetime.now(timezone.utc),
        )
        db.add(rel)
    else:
        rel.is_unlocked = True
        rel.unlocked_at = datetime.now(timezone.utc)
        db.add(rel)

    db.flush()

    # Build unlock story
    story = None
    if char.unlock_story:
        story = [
            UnlockStoryLine(speaker="system", text="你来到了新的区域..."),
            UnlockStoryLine(speaker=char.slug, text=char.unlock_story, emotion="excited"),
        ]

    return UnlockResponse(
        character_id=character_id,
        character_name=char.name,
        unlocked=True,
        unlock_story=story,
    )
