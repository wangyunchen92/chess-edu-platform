"""Schemas for user remark (备注名) feature."""

from pydantic import BaseModel, Field


class SetRemarkRequest(BaseModel):
    remark_name: str = Field(..., max_length=50, min_length=1, description="备注名")


class RemarkResponse(BaseModel):
    target_user_id: str
    remark_name: str

    model_config = {"from_attributes": True}
