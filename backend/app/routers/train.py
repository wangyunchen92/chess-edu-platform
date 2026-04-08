"""Train module router (B2-6 & B2-7)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import APIResponse
from app.schemas.train import (
    CompletePlanItemResponse,
    StreakResponse,
    TodayPlanResponse,
    TrainStatsResponse,
)
from app.services import train_service
from app.services.gamification_service import award_xp

router = APIRouter()


@router.get("/today", response_model=APIResponse[TodayPlanResponse])
def get_today_plan(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[TodayPlanResponse]:
    """Get today's training plan, creating one if needed."""
    user_id = current_user["user_id"]
    plan = train_service.get_or_create_today_plan(db, user_id)
    return APIResponse.success(data=plan)


@router.put("/today/items/{item_index}/complete", response_model=APIResponse[CompletePlanItemResponse])
def complete_plan_item(
    item_index: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[CompletePlanItemResponse]:
    """Complete a training plan item."""
    user_id = current_user["user_id"]
    try:
        result = train_service.complete_plan_item(db, user_id, item_index)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Award XP
    if result["xp_earned"] > 0:
        award_xp(db, user_id, result["xp_earned"], reason="train_item_complete")

    # Check if all training items are completed -> grant credits reward
    try:
        plan = train_service.get_or_create_today_plan(db, user_id)
        items = plan.get("items", [])
        if items and all(item.get("completed", False) for item in items):
            from app.services.credit_service import grant_daily_reward
            grant_daily_reward(db, user_id, "training_complete")
    except Exception:
        pass

    return APIResponse.success(data=result)


@router.get("/stats", response_model=APIResponse[TrainStatsResponse])
def get_train_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[TrainStatsResponse]:
    """Get training statistics."""
    user_id = current_user["user_id"]
    stats = train_service.get_train_stats(db, user_id)
    return APIResponse.success(data=stats)


@router.get("/streak", response_model=APIResponse[StreakResponse])
def get_streak(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[StreakResponse]:
    """Get streak information."""
    user_id = current_user["user_id"]
    data = train_service.get_streak_info(db, user_id)
    return APIResponse.success(data=data)
