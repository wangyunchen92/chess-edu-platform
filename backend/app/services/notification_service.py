"""Notification service layer (B2-12)."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.notification import Notification


def create_notification(
    db: Session,
    user_id: str,
    type: str,
    title: str,
    content: str,
    extra_data: dict | None = None,
) -> Notification:
    """Create a new notification for a user."""
    notif = Notification(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type=type,
        title=title,
        content=content,
        extra_data=extra_data,
    )
    db.add(notif)
    db.flush()
    return notif


def get_notifications(db: Session, user_id: str, limit: int = 20) -> dict:
    """Get notifications for a user."""
    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    notifications = db.execute(stmt).scalars().all()

    unread_stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id,
        Notification.is_read.is_(False),
    )
    unread_count = db.execute(unread_stmt).scalar() or 0

    total_stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id,
    )
    total = db.execute(total_stmt).scalar() or 0

    items = []
    for n in notifications:
        items.append({
            "id": n.id,
            "type": n.type,
            "title": n.title,
            "content": n.content,
            "is_read": n.is_read,
            "extra_data": n.extra_data,
            "created_at": n.created_at,
        })

    return {
        "notifications": items,
        "unread_count": unread_count,
        "total": total,
    }


def mark_as_read(db: Session, notification_id: str, user_id: str) -> bool:
    """Mark a notification as read. Returns True if found and updated."""
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == user_id,
    )
    notif = db.execute(stmt).scalar_one_or_none()
    if notif is None:
        return False

    notif.is_read = True
    db.add(notif)
    db.flush()
    return True


def get_unread_count(db: Session, user_id: str) -> int:
    """Get count of unread notifications."""
    stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id,
        Notification.is_read.is_(False),
    )
    return db.execute(stmt).scalar() or 0
