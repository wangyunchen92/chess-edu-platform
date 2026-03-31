"""Diagnosis (weakness profile) module router (Phase 2a F3)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import APIResponse
from app.schemas.diagnosis import (
    AnalyzeRequest,
    AnalyzeResponse,
    DiagnosisSummaryResponse,
    RecommendationItem,
    UpdateRecommendationRequest,
    UpdateRecommendationResponse,
    WeaknessProfileResponse,
)
from app.services import diagnosis_service

router = APIRouter()


@router.get("/profile", response_model=APIResponse[WeaknessProfileResponse])
def get_weakness_profile(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[WeaknessProfileResponse]:
    """Get current user's weakness profile."""
    user_id = current_user["user_id"]
    profile = diagnosis_service.get_profile(db, user_id)
    return APIResponse.success(data=profile)


@router.post("/analyze", response_model=APIResponse[AnalyzeResponse])
def analyze_weakness(
    request: AnalyzeRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[AnalyzeResponse]:
    """Trigger weakness analysis for the current user."""
    user_id = current_user["user_id"]
    result = diagnosis_service.analyze(db, user_id, force=request.force)
    return APIResponse.success(data=result)


@router.get("/recommendations", response_model=APIResponse[list[RecommendationItem]])
def get_recommendations(
    limit: int = Query(5, ge=1, le=20),
    rec_status: str = Query("active", alias="status"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[list[RecommendationItem]]:
    """Get weakness-based training recommendations."""
    user_id = current_user["user_id"]
    items = diagnosis_service.get_recommendations(db, user_id, limit=limit, status=rec_status)
    return APIResponse.success(data=items)


@router.patch("/recommendations/{rec_id}", response_model=APIResponse[UpdateRecommendationResponse])
def update_recommendation(
    rec_id: str,
    request: UpdateRecommendationRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[UpdateRecommendationResponse]:
    """Update a recommendation's status (completed / dismissed)."""
    user_id = current_user["user_id"]
    result = diagnosis_service.update_recommendation(db, user_id, rec_id, request.status)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation not found",
        )
    return APIResponse.success(data=result)


@router.get("/summary", response_model=APIResponse[DiagnosisSummaryResponse])
def get_diagnosis_summary(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[DiagnosisSummaryResponse]:
    """Get lightweight diagnosis summary for dashboard."""
    user_id = current_user["user_id"]
    summary = diagnosis_service.get_summary(db, user_id)
    return APIResponse.success(data=summary)
