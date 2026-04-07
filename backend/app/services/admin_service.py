"""Admin management service layer."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.gamification import RatingHistory, UserRating
from app.models.user import User
from app.schemas.admin import (
    AdminStatsResponse,
    AdminUpdateUserRequest,
    AdjustPointsRequest,
    BatchMembershipResult,
    BatchUpdateMembershipRequest,
    CreateUserRequest,
    RecentUserItem,
    UserListItem,
    UserListResponse,
    UserPointsDetail,
)
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
    role: Optional[str] = None,
    status: Optional[str] = None,
    membership_tier: Optional[str] = None,
) -> UserListResponse:
    """List users with pagination and optional search/filters.

    Args:
        db: Database session.
        page: Page number (1-based).
        page_size: Number of items per page.
        search: Optional search string to filter by username or nickname.
        role: Optional role filter.
        status: Optional status filter.
        membership_tier: Optional membership tier filter.

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

    if role:
        base_stmt = base_stmt.where(User.role == role)
        count_stmt = count_stmt.where(User.role == role)
    if status:
        base_stmt = base_stmt.where(User.status == status)
        count_stmt = count_stmt.where(User.status == status)
    if membership_tier:
        base_stmt = base_stmt.where(User.membership_tier == membership_tier)
        count_stmt = count_stmt.where(User.membership_tier == membership_tier)

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


def get_admin_stats(db: Session) -> AdminStatsResponse:
    """Get admin dashboard statistics.

    Returns:
        AdminStatsResponse with overview stats.
    """
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    total_users = db.execute(select(func.count(User.id))).scalar() or 0

    today_registered = db.execute(
        select(func.count(User.id)).where(User.created_at >= today_start)
    ).scalar() or 0

    today_active = db.execute(
        select(func.count(User.id)).where(User.last_login_at >= today_start)
    ).scalar() or 0

    # Membership distribution
    membership_rows = db.execute(
        select(User.membership_tier, func.count(User.id)).group_by(User.membership_tier)
    ).all()
    membership_distribution = {"free": 0, "basic": 0, "premium": 0}
    for tier, count in membership_rows:
        membership_distribution[tier] = count

    # Role distribution
    role_rows = db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    ).all()
    role_distribution = {"student": 0, "teacher": 0, "admin": 0}
    for role_val, count in role_rows:
        role_distribution[role_val] = count

    # Recent users
    recent_users_rows = db.execute(
        select(User).order_by(User.created_at.desc()).limit(10)
    ).scalars().all()

    recent_users = [RecentUserItem.model_validate(u) for u in recent_users_rows]

    return AdminStatsResponse(
        total_users=total_users,
        today_registered=today_registered,
        today_active=today_active,
        membership_distribution=membership_distribution,
        role_distribution=role_distribution,
        recent_users=recent_users,
    )


def update_user(
    db: Session,
    user_id: str,
    data: AdminUpdateUserRequest,
) -> User:
    """Update user info (partial update).

    Raises:
        ValueError: If user not found.
    """
    stmt = select(User).where(User.id == user_id)
    user = db.execute(stmt).scalar_one_or_none()

    if user is None:
        raise ValueError("User not found")

    if data.nickname is not None:
        user.nickname = data.nickname
    if data.role is not None:
        user.role = data.role

    db.flush()
    return user


def reset_password(db: Session, user_id: str, new_password: str) -> None:
    """Reset a user's password.

    Raises:
        ValueError: If user not found.
    """
    stmt = select(User).where(User.id == user_id)
    user = db.execute(stmt).scalar_one_or_none()

    if user is None:
        raise ValueError("User not found")

    user.password_hash = hash_password(new_password)
    db.flush()


def update_user_status(
    db: Session,
    user_id: str,
    new_status: str,
    admin_user_id: str,
) -> User:
    """Update user status (enable/disable).

    Raises:
        ValueError: If user not found or admin tries to disable self.
    """
    if user_id == admin_user_id:
        raise ValueError("Cannot disable your own account")

    stmt = select(User).where(User.id == user_id)
    user = db.execute(stmt).scalar_one_or_none()

    if user is None:
        raise ValueError("User not found")

    user.status = new_status
    db.flush()
    return user


def batch_update_membership(
    db: Session,
    data: BatchUpdateMembershipRequest,
) -> BatchMembershipResult:
    """Batch update membership for multiple users.

    Returns:
        BatchMembershipResult with success count and failures.
    """
    # Batch fetch users
    stmt = select(User).where(User.id.in_(data.user_ids))
    users = {str(u.id): u for u in db.execute(stmt).scalars().all()}

    success_count = 0
    failed: list[dict] = []

    for uid in data.user_ids:
        user = users.get(uid)
        if user is None:
            failed.append({"user_id": uid, "reason": "User not found"})
            continue

        user.membership_tier = data.membership_tier
        if data.membership_expires_at is not None:
            user.membership_expires_at = data.membership_expires_at
        elif data.membership_tier != "free":
            user.membership_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        else:
            user.membership_expires_at = None

        success_count += 1

    db.flush()

    return BatchMembershipResult(
        success_count=success_count,
        failed=failed,
    )


def get_user_points(db: Session, user_id: str) -> UserPointsDetail:
    """Get user points/rating detail.

    Raises:
        ValueError: If user not found.
    """
    stmt = select(User).where(User.id == user_id)
    user = db.execute(stmt).scalar_one_or_none()

    if user is None:
        raise ValueError("User not found")

    rating = user.rating

    return UserPointsDetail(
        user_id=str(user.id),
        username=user.username,
        nickname=user.nickname,
        game_rating=rating.game_rating if rating else 300,
        puzzle_rating=rating.puzzle_rating if rating else 300,
        rank_title=rating.rank_title if rating else "apprentice_1",
        rank_tier=rating.rank_tier if rating else 1,
        rank_region=rating.rank_region if rating else "meadow",
        xp_total=rating.xp_total if rating else 0,
        xp_today=rating.xp_today if rating else 0,
        coins=rating.coins if rating else 0,
    )


def get_user_detail(db: Session, user_id: str):
    """Get detailed info for any user (admin only)."""
    from app.services.teacher_service import (
        _build_course_stats,
        _build_game_stats,
        _build_puzzle_stats,
    )
    from app.schemas.teacher import (
        StudentDetailResponse,
        StudentProfileInfo,
        StudentRatingsInfo,
        StreakInfo,
    )

    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()

    if user is None:
        raise ValueError("用户不存在")

    # Profile
    profile_info = StudentProfileInfo()
    if user.profile:
        profile_info = StudentProfileInfo(
            birth_year=user.profile.birth_year,
            chess_experience=user.profile.chess_experience,
            assessment_done=user.profile.assessment_done,
            initial_rating=user.profile.initial_rating,
        )

    # Ratings
    ratings_info = StudentRatingsInfo()
    if user.rating:
        ratings_info = StudentRatingsInfo(
            game_rating=user.rating.game_rating,
            puzzle_rating=user.rating.puzzle_rating,
            rank_title=user.rating.rank_title,
            rank_tier=user.rating.rank_tier,
            rank_region=user.rating.rank_region,
            xp_total=user.rating.xp_total,
            coins=user.rating.coins,
        )

    # Stats
    game_stats = _build_game_stats(db, user_id)
    puzzle_stats = _build_puzzle_stats(db, user_id)
    course_stats = _build_course_stats(db, user_id)

    # Streak
    streak_info = StreakInfo()
    if user.streak:
        streak_info = StreakInfo(
            current_login_streak=user.streak.login_streak,
            max_login_streak=user.streak.login_streak_max,
            current_train_streak=user.streak.train_streak,
        )

    return StudentDetailResponse(
        student_id=user_id,
        username=user.username,
        nickname=user.nickname,
        avatar_url=user.avatar_url,
        bindtime=user.created_at,
        profile=profile_info,
        ratings=ratings_info,
        game_stats=game_stats,
        puzzle_stats=puzzle_stats,
        course_stats=course_stats,
        streak=streak_info,
        last_active_at=user.last_login_at,
    )


def adjust_user_points(
    db: Session,
    user_id: str,
    data: AdjustPointsRequest,
    admin_user_id: str,
) -> UserPointsDetail:
    """Adjust user points/xp/coins with audit trail.

    Raises:
        ValueError: If user not found or resulting values would be negative.
    """
    stmt = select(User).where(User.id == user_id)
    user = db.execute(stmt).scalar_one_or_none()

    if user is None:
        raise ValueError("User not found")

    # Ensure user_rating exists
    rating = user.rating
    if rating is None:
        rating = UserRating(user_id=user_id)
        db.add(rating)
        db.flush()

    # Calculate new values and validate
    new_xp = rating.xp_total + data.xp_change
    new_coins = rating.coins + data.coins_change
    new_game_rating = rating.game_rating + data.game_rating_change
    new_puzzle_rating = rating.puzzle_rating + data.puzzle_rating_change

    if new_xp < 0:
        raise ValueError("XP cannot be negative after adjustment")
    if new_coins < 0:
        raise ValueError("Coins cannot be negative after adjustment")
    if new_game_rating < 100:
        raise ValueError("Game rating cannot be below 100 after adjustment")
    if new_puzzle_rating < 100:
        raise ValueError("Puzzle rating cannot be below 100 after adjustment")

    # Write rating_histories for each non-zero change
    changes = [
        ("xp", rating.xp_total, new_xp, data.xp_change),
        ("coins", rating.coins, new_coins, data.coins_change),
        ("game", rating.game_rating, new_game_rating, data.game_rating_change),
        ("puzzle", rating.puzzle_rating, new_puzzle_rating, data.puzzle_rating_change),
    ]

    for rating_type, old_val, new_val, change_amount in changes:
        if change_amount != 0:
            history = RatingHistory(
                user_id=user_id,
                rating_type=rating_type,
                old_rating=old_val,
                new_rating=new_val,
                change_amount=change_amount,
                source_type="admin_adjust",
                source_id=admin_user_id,
            )
            db.add(history)

    # Apply updates
    rating.xp_total = new_xp
    rating.coins = new_coins
    rating.game_rating = new_game_rating
    rating.puzzle_rating = new_puzzle_rating

    db.flush()

    return UserPointsDetail(
        user_id=str(user.id),
        username=user.username,
        nickname=user.nickname,
        game_rating=rating.game_rating,
        puzzle_rating=rating.puzzle_rating,
        rank_title=rating.rank_title,
        rank_tier=rating.rank_tier,
        rank_region=rating.rank_region,
        xp_total=rating.xp_total,
        xp_today=rating.xp_today,
        coins=rating.coins,
    )
