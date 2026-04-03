"""Schemas for student-side teacher-related APIs."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class JoinTeacherRequest(BaseModel):
    invite_code: str = Field(
        ..., min_length=6, max_length=6, pattern="^[A-Z0-9]{6}$"
    )


class JoinTeacherResponse(BaseModel):
    teacher_id: str
    teacher_nickname: str
    bindtime: datetime


class MyTeacherItem(BaseModel):
    teacher_id: str
    teacher_nickname: str
    teacher_avatar_url: Optional[str] = None
    bindtime: datetime
