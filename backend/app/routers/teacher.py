"""Teacher management router: invite codes, student list, student detail."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import APIResponse
from app.schemas.teacher import (
    CreateInviteCodeRequest,
    InviteCodeResponse,
    StudentDetailResponse,
    TeacherStudentListResponse,
)
from app.services import teacher_service

router = APIRouter()


def require_teacher(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that ensures the current user is a teacher."""
    if current_user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher privileges required",
        )
    return current_user


@router.post("/invite-codes", response_model=APIResponse[InviteCodeResponse])
def create_invite_code(
    request: CreateInviteCodeRequest = None,
    teacher_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> APIResponse[InviteCodeResponse]:
    """Generate a new invite code."""
    if request is None:
        request = CreateInviteCodeRequest()
    try:
        invite = teacher_service.create_invite_code(
            db,
            teacher_id=teacher_user["user_id"],
            max_uses=request.max_uses,
        )
        return APIResponse.success(
            data=InviteCodeResponse.model_validate(invite)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/invite-codes", response_model=APIResponse[list[InviteCodeResponse]])
def list_invite_codes(
    teacher_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> APIResponse[list[InviteCodeResponse]]:
    """List all invite codes for the current teacher."""
    codes = teacher_service.list_invite_codes(db, teacher_user["user_id"])
    return APIResponse.success(data=codes)


@router.delete("/invite-codes/{code_id}", response_model=APIResponse[dict])
def revoke_invite_code(
    code_id: str,
    teacher_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> APIResponse[dict]:
    """Revoke an invite code."""
    try:
        teacher_service.revoke_invite_code(
            db, teacher_user["user_id"], code_id
        )
        return APIResponse.success(data={"message": "Invite code revoked"})
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/students", response_model=APIResponse[TeacherStudentListResponse])
def list_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    teacher_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> APIResponse[TeacherStudentListResponse]:
    """List teacher's students with summary data."""
    result = teacher_service.list_students(
        db,
        teacher_id=teacher_user["user_id"],
        page=page,
        page_size=page_size,
        search=search,
    )
    return APIResponse.success(data=result)


@router.get("/students/{student_id}", response_model=APIResponse[StudentDetailResponse])
def get_student_detail(
    student_id: str,
    teacher_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> APIResponse[StudentDetailResponse]:
    """Get detailed info for a specific student."""
    try:
        detail = teacher_service.get_student_detail(
            db, teacher_user["user_id"], student_id
        )
        return APIResponse.success(data=detail)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/students/{student_id}", response_model=APIResponse[dict])
def remove_student(
    student_id: str,
    teacher_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> APIResponse[dict]:
    """Unbind a student from this teacher."""
    try:
        teacher_service.remove_student(
            db, teacher_user["user_id"], student_id
        )
        return APIResponse.success(data={"message": "Student removed"})
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
