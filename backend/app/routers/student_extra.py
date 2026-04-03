"""Student extra router: join/leave teacher, list my teachers."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import APIResponse
from app.schemas.student import JoinTeacherRequest, JoinTeacherResponse, MyTeacherItem
from app.services import student_service

router = APIRouter()


def require_student(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that ensures the current user is a student."""
    if current_user.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student role required",
        )
    return current_user


@router.post("/join-teacher", response_model=APIResponse[JoinTeacherResponse])
def join_teacher(
    request: JoinTeacherRequest,
    student_user: dict = Depends(require_student),
    db: Session = Depends(get_db),
) -> APIResponse[JoinTeacherResponse]:
    """Join a teacher using an invite code."""
    try:
        result = student_service.join_teacher(
            db,
            student_id=student_user["user_id"],
            invite_code_str=request.invite_code,
        )
        return APIResponse.success(data=result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/my-teachers", response_model=APIResponse[list[MyTeacherItem]])
def list_my_teachers(
    student_user: dict = Depends(require_student),
    db: Session = Depends(get_db),
) -> APIResponse[list[MyTeacherItem]]:
    """List teachers the current student is bound to."""
    teachers = student_service.list_my_teachers(db, student_user["user_id"])
    return APIResponse.success(data=teachers)


@router.delete("/leave-teacher/{teacher_id}", response_model=APIResponse[dict])
def leave_teacher(
    teacher_id: str,
    student_user: dict = Depends(require_student),
    db: Session = Depends(get_db),
) -> APIResponse[dict]:
    """Leave a teacher (unbind)."""
    try:
        student_service.leave_teacher(
            db,
            student_id=student_user["user_id"],
            teacher_id=teacher_id,
        )
        return APIResponse.success(data={"message": "Left teacher successfully"})
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
