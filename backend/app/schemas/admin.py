"""Admin management schemas."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CreateUserRequest(BaseModel):
    """Request to create a single user."""

    username: str = Field(..., min_length=2, max_length=50, description="Username")
    password: str = Field(..., min_length=6, max_length=128, description="Password")
    nickname: str = Field(..., min_length=1, max_length=50, description="Display nickname")
    role: str = Field(default="student", description="User role: student, teacher, admin")


class BatchCreateUserRequest(BaseModel):
    """Request to batch create users."""

    users: list[CreateUserRequest] = Field(
        ..., min_length=1, max_length=100, description="List of users to create"
    )


class UpdateMembershipRequest(BaseModel):
    """Request to update user membership."""

    membership_tier: str = Field(
        ..., description="Membership tier: free, basic, premium"
    )
    membership_expires_at: Optional[datetime] = Field(
        None, description="Expiration date for the membership"
    )


class UserListItem(BaseModel):
    """User item in list response."""

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

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    """Paginated user list response data."""

    items: list[UserListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class BatchCreateResult(BaseModel):
    """Result of batch user creation."""

    created: list[UserListItem] = Field(default_factory=list)
    failed: list[dict] = Field(
        default_factory=list, description="List of {username, reason} for failures"
    )
