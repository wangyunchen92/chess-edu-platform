"""Service layer for user remarks (备注名)."""

from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.remark import UserRemark
from app.models.user import User
from app.schemas.remark import RemarkResponse


def set_remark(
    db: Session,
    user_id: str,
    target_user_id: str,
    remark_name: str,
) -> UserRemark:
    """Set or update a remark for a target user.

    Raises:
        ValueError: If the target user does not exist.
    """
    # Verify target user exists
    target = db.execute(
        select(User.id).where(User.id == target_user_id)
    ).first()
    if target is None:
        raise ValueError("Target user not found")

    # Check existing remark
    stmt = select(UserRemark).where(
        UserRemark.user_id == user_id,
        UserRemark.target_user_id == target_user_id,
    )
    existing = db.execute(stmt).scalar_one_or_none()

    if existing is not None:
        existing.remark_name = remark_name
        db.flush()
        return existing

    remark = UserRemark(
        user_id=user_id,
        target_user_id=target_user_id,
        remark_name=remark_name,
    )
    db.add(remark)
    db.flush()
    return remark


def list_remarks(db: Session, user_id: str) -> List[RemarkResponse]:
    """List all remarks set by a user."""
    stmt = (
        select(UserRemark)
        .where(UserRemark.user_id == user_id)
        .order_by(UserRemark.updated_at.desc())
    )
    remarks = db.execute(stmt).scalars().all()
    return [RemarkResponse.model_validate(r) for r in remarks]


def delete_remark(db: Session, user_id: str, target_user_id: str) -> None:
    """Delete a remark for a target user.

    Raises:
        ValueError: If the remark does not exist.
    """
    stmt = select(UserRemark).where(
        UserRemark.user_id == user_id,
        UserRemark.target_user_id == target_user_id,
    )
    remark = db.execute(stmt).scalar_one_or_none()

    if remark is None:
        raise ValueError("Remark not found")

    db.delete(remark)
    db.flush()


def get_remarks_map(db: Session, user_id: str, target_user_ids: List[str]) -> dict:
    """Batch fetch remarks for multiple target users.

    Returns:
        dict mapping target_user_id -> remark_name
    """
    if not target_user_ids:
        return {}

    stmt = select(UserRemark.target_user_id, UserRemark.remark_name).where(
        UserRemark.user_id == user_id,
        UserRemark.target_user_id.in_(target_user_ids),
    )
    rows = db.execute(stmt).all()
    return {row.target_user_id: row.remark_name for row in rows}
