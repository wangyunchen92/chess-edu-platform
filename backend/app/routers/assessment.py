"""Assessment module router (B1-8)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.assessment import (
    AssessmentQuestionsResponse,
    AssessmentResultResponse,
    SubmitAssessmentRequest,
)
from app.schemas.common import APIResponse
from app.services import assessment_service

router = APIRouter()


@router.get("/questions", response_model=APIResponse[AssessmentQuestionsResponse])
def get_questions(
    experience_level: str = Query(
        ...,
        description="User's experience level: none, beginner, intermediate, advanced",
    ),
    current_user: dict = Depends(get_current_user),
) -> APIResponse[AssessmentQuestionsResponse]:
    """Get assessment questions based on experience level."""
    data = assessment_service.get_assessment_questions(experience_level)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid experience level: {experience_level}",
        )
    return APIResponse.success(data=data)


@router.post("/submit", response_model=APIResponse[AssessmentResultResponse])
def submit_assessment(
    request: SubmitAssessmentRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[AssessmentResultResponse]:
    """Submit assessment answers and compute initial rating."""
    user_id = current_user["user_id"]
    result = assessment_service.submit_assessment(
        db=db,
        user_id=user_id,
        experience_level=request.experience_level,
        answers=request.answers,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid experience level or user not found",
        )
    return APIResponse.success(data=result)
