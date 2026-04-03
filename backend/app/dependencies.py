"""Global dependencies for dependency injection."""

from typing import Optional

from fastapi import Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.utils.security import decode_token


def _check_user_status(db: Session, user_id: str) -> None:
    """Check if a user exists and is active. Raises 401 if not."""
    stmt = select(User.id, User.status).where(User.id == user_id)
    row = db.execute(stmt).first()
    if row is None or row.status == "disabled":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> dict:
    """Extract and validate the current user from JWT token.

    Returns a dict with user info from the token payload.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    _check_user_status(db, user_id)

    return {
        "user_id": user_id,
        "username": payload.get("username"),
        "role": payload.get("role", "student"),
    }


def get_optional_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[dict]:
    """Same as get_current_user but returns None instead of raising."""
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    if payload is None:
        return None

    user_id = payload.get("sub")
    # Disabled users are treated as unauthenticated
    stmt = select(User.id, User.status).where(User.id == user_id)
    row = db.execute(stmt).first()
    if row is None or row.status == "disabled":
        return None

    return {
        "user_id": user_id,
        "username": payload.get("username"),
        "role": payload.get("role", "student"),
    }


def require_teacher(current_user: dict = Depends(get_current_user)) -> dict:
    """Ensure the current user has the teacher role."""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher privileges required",
        )
    return current_user


def require_student(current_user: dict = Depends(get_current_user)) -> dict:
    """Ensure the current user has the student role."""
    if current_user.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student role required",
        )
    return current_user


class PaginationParams:
    """Common pagination parameters."""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number"),
        page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    ):
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size
