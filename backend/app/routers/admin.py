"""Admin management router."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.admin import (
    BatchCreateResult,
    BatchCreateUserRequest,
    CreateUserRequest,
    UpdateMembershipRequest,
    UserListItem,
    UserListResponse,
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


@router.get("/users", response_model=APIResponse[UserListResponse])
def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by username or nickname"),
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[UserListResponse]:
    """List users with pagination and search (admin only)."""
    result = admin_service.list_users(db, page, page_size, search)
    return APIResponse.success(data=result)


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
