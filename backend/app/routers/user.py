"""User module router (B1-7)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import APIResponse
from app.schemas.user import (
    ProfileStatsResponse,
    UpdateSettingsRequest,
    UpdateUserRequest,
    UserFullResponse,
)
from app.services import user_service

router = APIRouter()


@router.get("/me", response_model=APIResponse[UserFullResponse])
def get_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[UserFullResponse]:
    """Get current user's full information including profile, rating, and streak."""
    user_id = current_user["user_id"]
    data = user_service.get_user_full(db, user_id)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return APIResponse.success(data=data)


@router.get("/profile/stats", response_model=APIResponse[ProfileStatsResponse])
def get_profile_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[ProfileStatsResponse]:
    """Get aggregated profile statistics (games, puzzles, learning, achievements)."""
    user_id = current_user["user_id"]
    data = user_service.get_profile_stats(db, user_id)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return APIResponse.success(data=data)


@router.put("/me", response_model=APIResponse[UserFullResponse])
def update_me(
    request: UpdateUserRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[UserFullResponse]:
    """Update current user's basic info (nickname, avatar_url)."""
    user_id = current_user["user_id"]
    data = user_service.update_user_info(db, user_id, request)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return APIResponse.success(data=data)


@router.put("/me/settings", response_model=APIResponse[UserFullResponse])
def update_settings(
    request: UpdateSettingsRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[UserFullResponse]:
    """Update current user's settings (theme, sound, notification, etc.)."""
    user_id = current_user["user_id"]
    data = user_service.update_user_settings(db, user_id, request)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return APIResponse.success(data=data)
