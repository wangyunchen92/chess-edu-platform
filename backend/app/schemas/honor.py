"""Honor record schemas."""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CreateHonorRequest(BaseModel):
    user_id: str = Field(..., description="学员ID")
    title: str = Field(..., max_length=200, description="荣誉标题")
    description: Optional[str] = Field(None, description="补充说明")
    rank: Optional[str] = Field(None, max_length=50, description="名次")
    competition_name: str = Field(..., max_length=200, description="赛事名称")
    competition_date: date = Field(..., description="赛事日期")
    is_public: bool = Field(True, description="是否上光荣榜")


class UpdateHonorRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None)
    rank: Optional[str] = Field(None, max_length=50)
    competition_name: Optional[str] = Field(None, max_length=200)
    competition_date: Optional[date] = Field(None)
    is_public: Optional[bool] = Field(None)


class HonorWallItem(BaseModel):
    id: str
    user_nickname: str
    user_avatar_url: Optional[str] = None
    title: str
    description: Optional[str] = None
    rank: Optional[str] = None
    competition_name: str
    competition_date: date
    created_at: datetime

    model_config = {"from_attributes": True}


class CompetitionHonorItem(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    rank: Optional[str] = None
    competition_name: str
    competition_date: date
    is_public: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MilestoneItem(BaseModel):
    milestone_key: str
    title: str
    category: str
    target_value: int
    achieved: bool
    achieved_at: Optional[datetime] = None
    current_value: int = 0


class MyHonorResponse(BaseModel):
    competitions: List[CompetitionHonorItem]
    milestones: List[MilestoneItem]
