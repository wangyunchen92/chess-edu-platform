"""Honor module router — honor wall, milestones, competition records."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user, get_optional_user
from app.models.teacher import TeacherStudent
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.honor import (
    CompetitionHonorItem,
    CreateHonorRequest,
    HonorWallItem,
    MyHonorResponse,
    UpdateHonorRequest,
)
from app.services import honor_service

router = APIRouter()


def _require_teacher_or_admin(current_user: dict) -> None:
    """Raise 403 if user is not teacher or admin."""
    if current_user.get("role") not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher or admin privileges required",
        )


def _check_teacher_student_binding(db: Session, teacher_id: str, student_id: str) -> None:
    """Raise 403 if teacher does not have an active binding with student."""
    binding = db.execute(
        select(TeacherStudent).where(
            TeacherStudent.teacher_id == teacher_id,
            TeacherStudent.student_id == student_id,
            TeacherStudent.status == "active",
        )
    ).scalar_one_or_none()
    if binding is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active teacher-student binding",
        )


# ── Public endpoints ─────────────────────────────────────────────


@router.get("/wall", response_model=PaginatedResponse[HonorWallItem])
def get_honor_wall(
    competition_name: str = Query(None, description="按赛事名称筛选"),
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> PaginatedResponse[HonorWallItem]:
    """Get public honor wall (no auth required)."""
    items, total = honor_service.get_honor_wall(
        db,
        page=pagination.page,
        page_size=pagination.page_size,
        competition_name=competition_name,
    )
    return PaginatedResponse.create(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/wall/competitions", response_model=APIResponse[list])
def get_competition_names(
    db: Session = Depends(get_db),
) -> APIResponse:
    """Get distinct competition names (no auth required)."""
    names = honor_service.get_competition_names(db)
    return APIResponse.success(data=names)


# ── Authenticated endpoints ──────────────────────────────────────


@router.get("/mine", response_model=APIResponse[MyHonorResponse])
def get_my_honors(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse:
    """Get current user's honors (competitions + milestones with progress)."""
    user_id = current_user["user_id"]
    data = honor_service.get_my_honors(db, user_id)
    return APIResponse.success(data=data)


@router.get("/user/{user_id}", response_model=APIResponse[MyHonorResponse])
def get_user_honors(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse:
    """Get a student's honors (teacher/admin only)."""
    _require_teacher_or_admin(current_user)

    # Teacher must have active binding
    if current_user["role"] == "teacher":
        _check_teacher_student_binding(db, current_user["user_id"], user_id)

    data = honor_service.get_user_honors(db, user_id)
    return APIResponse.success(data=data)


# ── CRUD endpoints (teacher/admin) ───────────────────────────────


@router.post("/record", response_model=APIResponse[CompetitionHonorItem])
def create_honor_record(
    request: CreateHonorRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse:
    """Create a competition honor record (teacher/admin only)."""
    _require_teacher_or_admin(current_user)

    # Teacher must have active binding with the student
    if current_user["role"] == "teacher":
        _check_teacher_student_binding(db, current_user["user_id"], request.user_id)

    record = honor_service.create_competition_honor(
        db=db,
        user_id=request.user_id,
        created_by=current_user["user_id"],
        title=request.title,
        competition_name=request.competition_name,
        competition_date=request.competition_date,
        description=request.description,
        rank=request.rank,
        is_public=request.is_public,
    )
    return APIResponse.success(data={
        "id": record.id,
        "title": record.title,
        "description": record.description,
        "rank": record.rank,
        "competition_name": record.competition_name,
        "competition_date": record.competition_date,
        "is_public": record.is_public,
        "created_at": record.created_at,
    })


@router.put("/record/{record_id}", response_model=APIResponse[CompetitionHonorItem])
def update_honor_record(
    record_id: str,
    request: UpdateHonorRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse:
    """Update a competition honor record (teacher/admin only)."""
    _require_teacher_or_admin(current_user)

    update_data = request.model_dump(exclude_unset=True)
    try:
        record = honor_service.update_competition_honor(
            db=db,
            record_id=record_id,
            current_user_id=current_user["user_id"],
            current_role=current_user["role"],
            **update_data,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    return APIResponse.success(data={
        "id": record.id,
        "title": record.title,
        "description": record.description,
        "rank": record.rank,
        "competition_name": record.competition_name,
        "competition_date": record.competition_date,
        "is_public": record.is_public,
        "created_at": record.created_at,
    })


@router.delete("/record/{record_id}", response_model=APIResponse)
def delete_honor_record(
    record_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse:
    """Delete a competition honor record (teacher/admin only)."""
    _require_teacher_or_admin(current_user)

    try:
        deleted = honor_service.delete_competition_honor(
            db=db,
            record_id=record_id,
            current_user_id=current_user["user_id"],
            current_role=current_user["role"],
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    return APIResponse.success(message="Deleted successfully")
