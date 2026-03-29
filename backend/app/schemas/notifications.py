"""Notification module schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationItem(BaseModel):
    """A notification."""

    id: str
    type: str
    title: str
    content: str
    is_read: bool
    extra_data: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    """Notification list."""

    notifications: list[NotificationItem]
    unread_count: int
    total: int
