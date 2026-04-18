"""User module router (B1-7)."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.auth import ReferralInfoResponse
from app.schemas.common import APIResponse
from app.schemas.remark import RemarkResponse, SetRemarkRequest
from app.schemas.user import (
    ProfileStatsResponse,
    UpdateSettingsRequest,
    UpdateUserRequest,
    UserFullResponse,
)
from app.services import remark_service, user_service
from app.services.referral_service import get_referral_stats

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


@router.get("/referral", response_model=APIResponse[ReferralInfoResponse])
def get_referral(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[ReferralInfoResponse]:
    """Get current user's referral code and invitation stats.

    Auto-generates a referral code if the user doesn't have one yet.
    """
    user_id = current_user["user_id"]
    try:
        stats = get_referral_stats(db, user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return APIResponse.success(data=ReferralInfoResponse(**stats))


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


# ── Remark (备注名) endpoints ─────────────────────────────────────────────────


def _require_teacher_or_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that ensures the current user is a teacher or admin."""
    if current_user.get("role") not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher or admin privileges required",
        )
    return current_user


@router.put("/remark/{target_user_id}", response_model=APIResponse[RemarkResponse])
def set_remark(
    target_user_id: str,
    request: SetRemarkRequest,
    current_user: dict = Depends(_require_teacher_or_admin),
    db: Session = Depends(get_db),
) -> APIResponse[RemarkResponse]:
    """Set or update a remark name for a target user (teacher/admin only)."""
    try:
        remark = remark_service.set_remark(
            db,
            user_id=current_user["user_id"],
            target_user_id=target_user_id,
            remark_name=request.remark_name,
        )
        return APIResponse.success(data=RemarkResponse.model_validate(remark))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/remarks", response_model=APIResponse[List[RemarkResponse]])
def list_remarks(
    current_user: dict = Depends(_require_teacher_or_admin),
    db: Session = Depends(get_db),
) -> APIResponse[List[RemarkResponse]]:
    """List all remarks set by the current user (teacher/admin only)."""
    remarks = remark_service.list_remarks(db, user_id=current_user["user_id"])
    return APIResponse.success(data=remarks)


@router.delete("/remark/{target_user_id}", response_model=APIResponse[dict])
def delete_remark(
    target_user_id: str,
    current_user: dict = Depends(_require_teacher_or_admin),
    db: Session = Depends(get_db),
) -> APIResponse[dict]:
    """Delete a remark for a target user (teacher/admin only)."""
    try:
        remark_service.delete_remark(
            db,
            user_id=current_user["user_id"],
            target_user_id=target_user_id,
        )
        return APIResponse.success(data={"message": "Remark deleted"})
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
