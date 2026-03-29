"""Adventure module router (B3-3, B3-4)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.adventure import (
    AdventureMapResponse,
    ChallengeRecord,
    CompleteChallengeRequest,
    RegionDetail,
)
from app.schemas.common import APIResponse
from app.services import adventure_service

router = APIRouter()


# ── Map endpoints ────────────────────────────────────────────────


@router.get("/map", response_model=APIResponse[AdventureMapResponse])
def get_adventure_map(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[AdventureMapResponse]:
    """Get the full adventure map with regions and user progress."""
    user_id = current_user["user_id"]
    data = adventure_service.get_adventure_map(db, user_id)
    return APIResponse.success(data=data)


@router.get("/regions/{region_id}", response_model=APIResponse[RegionDetail])
def get_region_detail(
    region_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[RegionDetail]:
    """Get region detail with challenges."""
    user_id = current_user["user_id"]
    detail = adventure_service.get_region_detail(db, region_id, user_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Region not found",
        )
    return APIResponse.success(data=detail)


# ── Challenge endpoints ──────────────────────────────────────────


@router.post(
    "/promotion-challenge/{challenge_id}/start",
    response_model=APIResponse[ChallengeRecord],
)
def start_challenge(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[ChallengeRecord]:
    """Start a promotion challenge."""
    user_id = current_user["user_id"]
    record = adventure_service.start_challenge(db, user_id, challenge_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )
    return APIResponse.success(data=record)


@router.put(
    "/promotion-challenge/{challenge_id}/complete",
    response_model=APIResponse[ChallengeRecord],
)
def complete_challenge(
    challenge_id: str,
    request: CompleteChallengeRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[ChallengeRecord]:
    """Complete a promotion challenge with result."""
    user_id = current_user["user_id"]
    record = adventure_service.complete_challenge(
        db=db,
        user_id=user_id,
        challenge_id=challenge_id,
        result=request.result,
        game_id=request.game_id,
        quiz_answers=request.quiz_answers,
        quiz_score=request.quiz_score,
    )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending challenge found",
        )
    return APIResponse.success(data=record)
