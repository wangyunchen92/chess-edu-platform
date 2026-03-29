"""Global dependencies for dependency injection."""

from typing import Optional

from fastapi import Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.security import decode_token


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

    return {
        "user_id": payload.get("sub"),
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

    return {
        "user_id": payload.get("sub"),
        "username": payload.get("username"),
        "role": payload.get("role", "student"),
    }


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
