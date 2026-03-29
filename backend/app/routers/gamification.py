"""Gamification module router (B2-8 & B2-9 & B2-10)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import APIResponse
from app.schemas.gamification import (
    AchievementsResponse,
    CheckAchievementsResponse,
    RankResponse,
    XPResponse,
)
from app.services import gamification_service
from app.services import notification_service

router = APIRouter()


@router.get("/achievements", response_model=APIResponse[AchievementsResponse])
def get_achievements(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[AchievementsResponse]:
    """Get all achievements with user unlock status."""
    user_id = current_user["user_id"]
    data = gamification_service.get_achievements_with_status(db, user_id)
    return APIResponse.success(data=data)


@router.get("/xp", response_model=APIResponse[XPResponse])
def get_xp_info(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[XPResponse]:
    """Get XP, level, and coin information."""
    user_id = current_user["user_id"]
    data = gamification_service.get_xp_info(db, user_id)
    return APIResponse.success(data=data)


@router.get("/rank", response_model=APIResponse[RankResponse])
def get_rank_info(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[RankResponse]:
    """Get rank information with rating history."""
    user_id = current_user["user_id"]
    data = gamification_service.get_rank_info(db, user_id)
    return APIResponse.success(data=data)


@router.post("/check", response_model=APIResponse[CheckAchievementsResponse])
def check_achievements(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[CheckAchievementsResponse]:
    """Actively check and unlock any new achievements."""
    user_id = current_user["user_id"]
    newly_unlocked = gamification_service.check_achievements(db, user_id)

    total_xp = sum(a["xp_reward"] for a in newly_unlocked)
    total_coins = sum(a["coin_reward"] for a in newly_unlocked)

    # Create notifications for newly unlocked achievements
    for ach in newly_unlocked:
        notification_service.create_notification(
            db=db,
            user_id=user_id,
            type="achievement",
            title=f"成就解锁: {ach['name']}",
            content=ach["description"],
            extra_data={"achievement_slug": ach["slug"], "xp_reward": ach["xp_reward"]},
        )

    return APIResponse.success(data={
        "newly_unlocked": newly_unlocked,
        "xp_awarded": total_xp,
        "coins_awarded": total_coins,
    })
