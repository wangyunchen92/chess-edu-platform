"""Pydantic schemas for the credit system."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CreditBalanceResponse(BaseModel):
    """Current user credit balance."""

    balance: int
    total_earned: int
    total_spent: int

    model_config = {"from_attributes": True}


class CreditTransactionItem(BaseModel):
    """Single credit transaction record."""

    id: str
    amount: int
    balance_after: int
    type: str
    description: str
    related_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CreditTransactionListResponse(BaseModel):
    """Paginated list of credit transactions."""

    items: List[CreditTransactionItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class GrantCreditsRequest(BaseModel):
    """Admin: grant credits to a user."""

    user_id: str
    amount: int = Field(gt=0)
    description: str = "管理员充值"


class TransferCreditsRequest(BaseModel):
    """Teacher: transfer credits to students."""

    student_ids: List[str]
    amount: int = Field(gt=0)


class CreditPackageItem(BaseModel):
    """Credit recharge package."""

    id: str
    name: str
    credits: int
    price_cents: int
    is_active: bool = True

    model_config = {"from_attributes": True}


class InsufficientCreditsData(BaseModel):
    """Returned when credits are insufficient (402)."""

    required: int
    balance: int
