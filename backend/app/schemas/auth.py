"""Authentication schemas."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class LoginRequest(BaseModel):
    """Login request payload."""

    username: str = Field(..., min_length=1, max_length=50, description="Username")
    password: str = Field(..., min_length=1, max_length=128, description="Password")


class TokenData(BaseModel):
    """Token pair data."""

    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")


class LoginResponse(BaseModel):
    """Login response payload."""

    user: "UserResponse"
    tokens: TokenData


class TokenRefreshRequest(BaseModel):
    """Token refresh request payload."""

    refresh_token: str = Field(..., description="JWT refresh token")


class TokenRefreshResponse(BaseModel):
    """Token refresh response payload."""

    access_token: str = Field(..., description="New JWT access token")
    refresh_token: str = Field(..., description="New JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")


class UserResponse(BaseModel):
    """User info response payload.

    This is the lightweight user representation used in login responses
    and token-validation scenarios (GET /auth/me). For the full user info
    including profile, streak, and detailed rating, use UserFullResponse
    from schemas.user (served by GET /user/me).
    """

    id: uuid.UUID
    username: str
    nickname: str
    avatar_url: Optional[str] = None
    role: str
    status: str
    membership_tier: str
    membership_expires_at: Optional[datetime] = None
    created_at: datetime
    last_login_at: Optional[datetime] = None
    login_count: int

    # Lightweight rating fields populated manually from UserRating at login time.
    # Not auto-mapped from ORM (User.rating is a relationship, not an int).
    rating: Optional[int] = None
    rank_title: Optional[str] = None

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _strip_orm_relationships(cls, data: any) -> any:
        """Prevent ORM relationship objects from being parsed as scalar fields."""
        if hasattr(data, "__dict__"):
            # ORM model: only keep simple attributes, skip relationships
            d = {}
            for k, v in data.__dict__.items():
                if k.startswith("_"):
                    continue
                if k in ("rating",) and not isinstance(v, (int, type(None))):
                    continue  # skip ORM UserRating relationship
                d[k] = v
            return d
        return data


class RegisterRequest(BaseModel):
    """User registration request."""
    phone: str = Field(..., min_length=11, max_length=11, description="手机号")
    password: str = Field(..., min_length=6, max_length=128, description="密码")
    nickname: Optional[str] = Field(None, max_length=50, description="昵称")
    invite_code: str = Field(..., min_length=1, max_length=50, description="邀请码")
    ref: Optional[str] = Field(None, max_length=6, description="推荐码（好友邀请）")


class ReferralInfoResponse(BaseModel):
    """Referral info response."""
    code: str = Field(..., description="用户的推荐码")
    invited_count: int = Field(default=0, description="已邀请人数")


class ChangePasswordRequest(BaseModel):
    """Change password request."""
    old_password: str = Field(..., min_length=1, max_length=128, description="旧密码")
    new_password: str = Field(..., min_length=6, max_length=128, description="新密码")
