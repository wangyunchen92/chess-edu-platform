"""Notifications module router (B2-12)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import APIResponse
from app.schemas.notifications import NotificationListResponse
from app.services import notification_service

router = APIRouter()


@router.get("", response_model=APIResponse[NotificationListResponse])
def get_notifications(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[NotificationListResponse]:
    """Get notification list."""
    user_id = current_user["user_id"]
    data = notification_service.get_notifications(db, user_id)
    return APIResponse.success(data=data)


@router.put("/{notification_id}/read", response_model=APIResponse)
def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse:
    """Mark a notification as read."""
    user_id = current_user["user_id"]
    success = notification_service.mark_as_read(db, notification_id, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return APIResponse.success(message="Notification marked as read")
