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


class AdminUpdateUserRequest(BaseModel):
    """修改用户信息（所有字段 Optional，传什么改什么）"""

    nickname: Optional[str] = Field(None, min_length=1, max_length=50)
    role: Optional[str] = Field(None, pattern="^(student|teacher|admin)$")


class ResetPasswordRequest(BaseModel):
    """重置用户密码"""

    new_password: str = Field(..., min_length=6, max_length=128)


class UpdateStatusRequest(BaseModel):
    """禁用/启用用户"""

    status: str = Field(..., pattern="^(active|disabled)$")


class BatchUpdateMembershipRequest(BaseModel):
    """批量授权会员"""

    user_ids: list[str] = Field(..., min_length=1, max_length=100)
    membership_tier: str = Field(..., pattern="^(free|basic|premium)$")
    membership_expires_at: Optional[datetime] = None


class BatchMembershipResult(BaseModel):
    """批量授权会员结果"""

    success_count: int
    failed: list[dict] = Field(
        default_factory=list, description="List of {user_id, reason}"
    )


class RecentUserItem(BaseModel):
    """最近注册用户简要信息"""

    id: str
    username: str
    nickname: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminStatsResponse(BaseModel):
    """数据概览统计"""

    total_users: int
    today_registered: int
    today_active: int
    membership_distribution: dict[str, int]
    role_distribution: dict[str, int]
    recent_users: list[RecentUserItem]


class UserPointsDetail(BaseModel):
    """用户积分/经验详情"""

    user_id: str
    username: str
    nickname: str
    game_rating: int
    puzzle_rating: int
    rank_title: str
    rank_tier: int
    rank_region: str
    xp_total: int
    xp_today: int
    coins: int


class AdjustPointsRequest(BaseModel):
    """手动调整积分/经验/金币"""

    xp_change: int = Field(default=0, description="经验值变动，正增负减")
    coins_change: int = Field(default=0, description="金币变动，正增负减")
    game_rating_change: int = Field(default=0, description="对弈评分变动")
    puzzle_rating_change: int = Field(default=0, description="谜题评分变动")
    reason: str = Field(
        ..., min_length=1, max_length=200, description="调整原因（必填，用于审计）"
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
