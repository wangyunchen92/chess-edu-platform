"""Admin management router."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.admin import (
    AdminStatsResponse,
    AdminUpdateUserRequest,
    AdjustPointsRequest,
    BatchCreateResult,
    BatchCreateUserRequest,
    BatchMembershipResult,
    BatchUpdateMembershipRequest,
    CreateUserRequest,
    ResetPasswordRequest,
    UpdateMembershipRequest,
    UpdateStatusRequest,
    UserListItem,
    UserListResponse,
    UserPointsDetail,
)
from app.schemas.common import APIResponse
from app.services import admin_service

router = APIRouter()


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that ensures the current user is an admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


@router.get("/stats", response_model=APIResponse[AdminStatsResponse])
def get_admin_stats(
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[AdminStatsResponse]:
    """Get admin dashboard statistics."""
    stats = admin_service.get_admin_stats(db)
    return APIResponse.success(data=stats)


@router.post("/users", response_model=APIResponse[UserListItem])
def create_user(
    request: CreateUserRequest,
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[UserListItem]:
    """Create a single user (admin only)."""
    try:
        user = admin_service.create_user(
            db,
            request,
            created_by=admin_user["user_id"],
        )
        return APIResponse.success(data=UserListItem.model_validate(user))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/users/batch", response_model=APIResponse[BatchCreateResult])
def batch_create_users(
    request: BatchCreateUserRequest,
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[BatchCreateResult]:
    """Batch create users (admin only)."""
    created, failed = admin_service.batch_create_users(
        db,
        request.users,
        created_by=admin_user["user_id"],
    )
    return APIResponse.success(
        data=BatchCreateResult(
            created=[UserListItem.model_validate(u) for u in created],
            failed=failed,
        )
    )


# IMPORTANT: batch/membership must be registered BEFORE {user_id} routes
# to avoid "batch" being parsed as a user_id
@router.put("/users/batch/membership", response_model=APIResponse[BatchMembershipResult])
def batch_update_membership(
    request: BatchUpdateMembershipRequest,
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[BatchMembershipResult]:
    """Batch update membership for multiple users (admin only)."""
    result = admin_service.batch_update_membership(db, request)
    return APIResponse.success(data=result)


@router.get("/users", response_model=APIResponse[UserListResponse])
def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by username or nickname"),
    role: Optional[str] = Query(None, description="Filter by role"),
    status: Optional[str] = Query(None, description="Filter by status"),
    membership_tier: Optional[str] = Query(None, description="Filter by membership tier"),
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[UserListResponse]:
    """List users with pagination, search, and filters (admin only)."""
    result = admin_service.list_users(
        db, page, page_size, search,
        role=role, status=status, membership_tier=membership_tier,
        requester_id=admin_user["user_id"],
    )
    return APIResponse.success(data=result)


@router.put("/users/{user_id}", response_model=APIResponse[UserListItem])
def update_user(
    user_id: str,
    request: AdminUpdateUserRequest,
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[UserListItem]:
    """Update user info - partial update (admin only)."""
    try:
        user = admin_service.update_user(db, user_id, request)
        return APIResponse.success(data=UserListItem.model_validate(user))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.put("/users/{user_id}/password", response_model=APIResponse[dict])
def reset_password(
    user_id: str,
    request: ResetPasswordRequest,
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[dict]:
    """Reset a user's password (admin only)."""
    try:
        admin_service.reset_password(db, user_id, request.new_password)
        return APIResponse.success(data={"message": "Password reset successfully"})
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.put("/users/{user_id}/status", response_model=APIResponse[UserListItem])
def update_user_status(
    user_id: str,
    request: UpdateStatusRequest,
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[UserListItem]:
    """Enable or disable a user (admin only)."""
    try:
        user = admin_service.update_user_status(
            db, user_id, request.status, admin_user["user_id"],
        )
        return APIResponse.success(data=UserListItem.model_validate(user))
    except ValueError as e:
        error_msg = str(e)
        if "Cannot disable" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_msg,
        )


@router.put("/users/{user_id}/membership", response_model=APIResponse[UserListItem])
def update_membership(
    user_id: str,
    request: UpdateMembershipRequest,
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[UserListItem]:
    """Update a user's membership tier (admin only)."""
    try:
        user = admin_service.update_membership(
            db,
            user_id,
            request.membership_tier,
            request.membership_expires_at,
        )
        return APIResponse.success(data=UserListItem.model_validate(user))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/users/{user_id}/detail")
def get_user_detail(
    user_id: str,
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get detailed user info including stats (admin only)."""
    try:
        detail = admin_service.get_user_detail(db, user_id)
        return APIResponse.success(data=detail)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/users/{user_id}/points", response_model=APIResponse[UserPointsDetail])
def get_user_points(
    user_id: str,
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[UserPointsDetail]:
    """Get user points/rating detail (admin only)."""
    try:
        detail = admin_service.get_user_points(db, user_id)
        return APIResponse.success(data=detail)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.put("/users/{user_id}/points", response_model=APIResponse[UserPointsDetail])
def adjust_user_points(
    user_id: str,
    request: AdjustPointsRequest,
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[UserPointsDetail]:
    """Adjust user points/xp/coins (admin only)."""
    try:
        detail = admin_service.adjust_user_points(
            db, user_id, request, admin_user["user_id"],
        )
        return APIResponse.success(data=detail)
    except ValueError as e:
        error_msg = str(e)
        if "cannot be" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_msg,
        )
