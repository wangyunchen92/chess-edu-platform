"""Credits module router: balance, transactions, packages, admin grant."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import APIResponse
from app.schemas.credits import (
    CreditBalanceResponse,
    CreditPackageItem,
    CreditTransactionItem,
    CreditTransactionListResponse,
    GrantCreditsRequest,
)
from app.services import credit_service

router = APIRouter()


# ---- require_admin dependency (local) ----

def _require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


# ---- endpoints ----

@router.get("/balance", response_model=APIResponse[CreditBalanceResponse])
def get_balance(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[CreditBalanceResponse]:
    """Get the current user's credit balance."""
    bal = credit_service.get_or_create_balance(db, current_user["user_id"])
    return APIResponse.success(data=CreditBalanceResponse.model_validate(bal))


@router.get("/transactions", response_model=APIResponse[CreditTransactionListResponse])
def get_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[CreditTransactionListResponse]:
    """Get paginated credit transaction history."""
    rows, total = credit_service.get_transactions(
        db, current_user["user_id"], page, page_size
    )
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
    items = [CreditTransactionItem.model_validate(r) for r in rows]
    return APIResponse.success(data=CreditTransactionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    ))


@router.get("/packages", response_model=APIResponse[list[CreditPackageItem]])
def get_packages(
    db: Session = Depends(get_db),
) -> APIResponse[list[CreditPackageItem]]:
    """Get active credit packages."""
    pkgs = credit_service.get_packages(db)
    # pkgs may be ORM objects or dicts (from fallback)
    items = []
    for p in pkgs:
        if isinstance(p, dict):
            items.append(CreditPackageItem(**p))
        else:
            items.append(CreditPackageItem.model_validate(p))
    return APIResponse.success(data=items)


@router.post("/admin/grant", response_model=APIResponse[CreditBalanceResponse])
def admin_grant_credits(
    request: GrantCreditsRequest,
    admin_user: dict = Depends(_require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[CreditBalanceResponse]:
    """Admin: grant credits to any user."""
    bal = credit_service.add_credits(
        db,
        user_id=request.user_id,
        amount=request.amount,
        tx_type="recharge",
        description=request.description,
    )
    return APIResponse.success(data=CreditBalanceResponse.model_validate(bal))
