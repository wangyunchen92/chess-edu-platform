"""Authentication router."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.gamification import UserRating
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    ChangePasswordRequest,
    TokenRefreshRequest,
    TokenRefreshResponse,
    UserResponse,
)
from app.schemas.common import APIResponse
from app.services.auth_service import (
    authenticate_user,
    change_password,
    create_tokens,
    refresh_tokens,
    register_user,
    update_login_info,
)

router = APIRouter()


@router.post("/login", response_model=APIResponse[LoginResponse])
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
) -> APIResponse[LoginResponse]:
    """Authenticate user with username and password."""
    user = authenticate_user(db, request.username, request.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    update_login_info(db, user)

    tokens = create_tokens(user)
    user_resp = UserResponse.model_validate(user)

    # Populate lightweight rating fields from UserRating if available.
    user_rating = db.execute(
        select(UserRating).where(UserRating.user_id == str(user.id))
    ).scalar_one_or_none()
    if user_rating is not None:
        user_resp.rating = user_rating.puzzle_rating
        user_resp.rank_title = user_rating.rank_title

    return APIResponse.success(
        data=LoginResponse(
            user=user_resp,
            tokens=tokens,
        )
    )


@router.post("/register", response_model=APIResponse[LoginResponse])
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
) -> APIResponse[LoginResponse]:
    """Register a new user with phone number and invite code."""
    try:
        user = register_user(
            db,
            phone=request.phone,
            password=request.password,
            nickname=request.nickname,
            invite_code=request.invite_code,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    update_login_info(db, user)
    tokens = create_tokens(user)
    user_resp = UserResponse.model_validate(user)

    return APIResponse.success(
        data=LoginResponse(
            user=user_resp,
            tokens=tokens,
        )
    )


@router.post("/token/refresh", response_model=APIResponse[TokenRefreshResponse])
def token_refresh(
    request: TokenRefreshRequest,
) -> APIResponse[TokenRefreshResponse]:
    """Refresh access token using a valid refresh token."""
    result = refresh_tokens(request.refresh_token)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    return APIResponse.success(
        data=TokenRefreshResponse(**result)
    )


@router.post("/logout", response_model=APIResponse)
def logout(
    current_user: dict = Depends(get_current_user),
) -> APIResponse:
    """Logout current user.

    Note: With stateless JWT, the client should discard tokens.
    A full implementation would use a token blacklist (e.g., Redis).
    """
    return APIResponse.success(message="Logged out successfully")


@router.put("/password", response_model=APIResponse)
def update_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse:
    """Change current user's password."""
    try:
        change_password(
            db,
            user_id=current_user["user_id"],
            old_password=request.old_password,
            new_password=request.new_password,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return APIResponse.success(message="密码修改成功")


@router.get("/me", response_model=APIResponse[UserResponse])
def get_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[UserResponse]:
    """Get current authenticated user information (lightweight).

    This is a lightweight endpoint primarily used for token validation.
    It returns basic user info plus rating/rank_title.
    For the full user profile (including streak, detailed rating, and
    settings), use GET /user/me which returns UserFullResponse.
    """
    user_id = current_user["user_id"]

    stmt = select(User).where(User.id == user_id)
    result = db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user_resp = UserResponse.model_validate(user)

    # Populate lightweight rating fields from UserRating if available.
    user_rating = db.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    ).scalar_one_or_none()
    if user_rating is not None:
        user_resp.rating = user_rating.puzzle_rating
        user_resp.rank_title = user_rating.rank_title

    return APIResponse.success(data=user_resp)
