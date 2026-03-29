"""Admin management service layer."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.admin import CreateUserRequest, UserListItem, UserListResponse
from app.utils.security import hash_password


def create_user(
    db: Session,
    data: CreateUserRequest,
    created_by: Optional[str] = None,
) -> User:
    """Create a single user.

    Args:
        db: Database session.
        data: User creation data.
        created_by: UUID string of the admin who created the user.

    Returns:
        The created User object.

    Raises:
        ValueError: If the username already exists.
    """
    # Check for existing username
    stmt = select(User).where(User.username == data.username)
    result = db.execute(stmt)
    if result.scalar_one_or_none() is not None:
        raise ValueError(f"Username '{data.username}' already exists")

    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        nickname=data.nickname,
        role=data.role,
        created_by=created_by,
    )
    db.add(user)
    db.flush()
    return user


def batch_create_users(
    db: Session,
    users_data: list[CreateUserRequest],
    created_by: Optional[str] = None,
) -> tuple[list[User], list[dict]]:
    """Batch create users.

    Args:
        db: Database session.
        users_data: List of user creation data.
        created_by: UUID string of the admin who created the users.

    Returns:
        Tuple of (successfully created users, list of failures with reason).
    """
    created: list[User] = []
    failed: list[dict] = []

    # Pre-fetch existing usernames for efficiency
    usernames = [u.username for u in users_data]
    stmt = select(User.username).where(User.username.in_(usernames))
    result = db.execute(stmt)
    existing_usernames = {row[0] for row in result.fetchall()}

    for data in users_data:
        if data.username in existing_usernames:
            failed.append({
                "username": data.username,
                "reason": f"Username '{data.username}' already exists",
            })
            continue

        try:
            user = User(
                username=data.username,
                password_hash=hash_password(data.password),
                nickname=data.nickname,
                role=data.role,
                created_by=created_by,
            )
            db.add(user)
            db.flush()
            created.append(user)
            # Track to avoid duplicates within the batch
            existing_usernames.add(data.username)
        except IntegrityError:
            db.rollback()
            failed.append({
                "username": data.username,
                "reason": "Database integrity error (possible duplicate)",
            })

    return created, failed


def update_membership(
    db: Session,
    user_id: str,
    membership_tier: str,
    membership_expires_at: Optional[datetime] = None,
) -> User:
    """Update a user's membership tier and expiration.

    Args:
        db: Database session.
        user_id: The user's UUID string.
        membership_tier: New membership tier.
        membership_expires_at: Optional expiration datetime.

    Returns:
        The updated User object.

    Raises:
        ValueError: If the user is not found.
    """
    stmt = select(User).where(User.id == user_id)
    result = db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise ValueError("User not found")

    user.membership_tier = membership_tier
    if membership_expires_at is not None:
        user.membership_expires_at = membership_expires_at
    elif membership_tier != "free":
        # Default: 30 days from now for paid tiers
        user.membership_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    else:
        user.membership_expires_at = None
    db.add(user)
    db.flush()
    return user


def list_users(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
) -> UserListResponse:
    """List users with pagination and optional search.

    Args:
        db: Database session.
        page: Page number (1-based).
        page_size: Number of items per page.
        search: Optional search string to filter by username or nickname.

    Returns:
        UserListResponse with paginated results.
    """
    base_stmt = select(User)
    count_stmt = select(func.count(User.id))

    if search:
        search_filter = or_(
            User.username.ilike(f"%{search}%"),
            User.nickname.ilike(f"%{search}%"),
        )
        base_stmt = base_stmt.where(search_filter)
        count_stmt = count_stmt.where(search_filter)

    # Get total count
    total_result = db.execute(count_stmt)
    total = total_result.scalar() or 0

    # Get paginated results
    offset = (page - 1) * page_size
    stmt = base_stmt.order_by(User.created_at.desc()).offset(offset).limit(page_size)
    result = db.execute(stmt)
    users = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    return UserListResponse(
        items=[UserListItem.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
