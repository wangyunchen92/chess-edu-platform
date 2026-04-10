"""Learn module router (B2-3 & B2-4 & B2-5)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import APIResponse
from app.schemas.learn import (
    AITeachRequest,
    AITeachResponse,
    CourseDetail,
    CourseListItem,
    ExerciseAttemptRequest,
    ExerciseAttemptResponse,
    ExerciseItem,
    ExerciseOverviewCourse,
    KidsProgressItem,
    LessonContent,
    UpdateKidsProgressRequest,
    UpdateProgressRequest,
    UpdateProgressResponse,
)
from app.services import course_service, credit_service
from app.services.gamification_service import award_xp
from app.services.membership_service import consume_quota

router = APIRouter()


@router.get("/courses", response_model=APIResponse[list[CourseListItem]])
def list_courses(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[list[CourseListItem]]:
    """Get course list with user progress."""
    user_id = current_user["user_id"]
    courses = course_service.list_courses(db, user_id)
    return APIResponse.success(data=courses)


@router.get("/courses/{course_id}", response_model=APIResponse[CourseDetail])
def get_course_detail(
    course_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[CourseDetail]:
    """Get course detail with lesson list and progress."""
    user_id = current_user["user_id"]
    detail = course_service.get_course_detail(db, course_id, user_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )
    return APIResponse.success(data=detail)


@router.get("/exercises/overview", response_model=APIResponse[list[ExerciseOverviewCourse]])
def get_exercises_overview(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[list[ExerciseOverviewCourse]]:
    """Get exercise overview for all courses, grouped by course."""
    user_id = current_user["user_id"]
    data = course_service.get_exercises_overview(db, user_id)
    return APIResponse.success(data=data)


@router.get("/kids/progress", response_model=APIResponse[list[KidsProgressItem]])
def get_kids_progress(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[list[KidsProgressItem]]:
    """Get all kids game progress for current user."""
    from app.models.kids import KidsGameProgress

    user_id = current_user["user_id"]
    rows = (
        db.query(KidsGameProgress)
        .filter(KidsGameProgress.user_id == user_id)
        .order_by(KidsGameProgress.game_type, KidsGameProgress.level)
        .all()
    )
    items = [
        KidsProgressItem(
            game_type=r.game_type,
            level=r.level,
            completed=r.completed,
            stars=r.stars,
        )
        for r in rows
    ]
    return APIResponse.success(data=items)


@router.post("/kids/progress", response_model=APIResponse[KidsProgressItem])
def update_kids_progress(
    request: UpdateKidsProgressRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[KidsProgressItem]:
    """Create or update kids game progress (stars take max value)."""
    from datetime import datetime, timezone

    from app.models.kids import KidsGameProgress

    user_id = current_user["user_id"]

    row = (
        db.query(KidsGameProgress)
        .filter(
            KidsGameProgress.user_id == user_id,
            KidsGameProgress.game_type == request.game_type,
            KidsGameProgress.level == request.level,
        )
        .first()
    )

    if row is None:
        row = KidsGameProgress(
            user_id=user_id,
            game_type=request.game_type,
            level=request.level,
            stars=request.stars,
            completed=request.stars > 0,
            completed_at=datetime.now(timezone.utc) if request.stars > 0 else None,
        )
        db.add(row)
    else:
        # Stars only go up
        if request.stars > row.stars:
            row.stars = request.stars
        if not row.completed and request.stars > 0:
            row.completed = True
            row.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(row)

    item = KidsProgressItem(
        game_type=row.game_type,
        level=row.level,
        completed=row.completed,
        stars=row.stars,
    )
    return APIResponse.success(data=item)


@router.get("/lessons/{lesson_id}", response_model=APIResponse[LessonContent])
def get_lesson_content(
    lesson_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[LessonContent]:
    """Get lesson full content."""
    user_id = current_user["user_id"]
    content = course_service.get_lesson_content(db, lesson_id, user_id)
    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found",
        )
    return APIResponse.success(data=content)


@router.post("/lessons/{lesson_id}/progress", response_model=APIResponse[UpdateProgressResponse])
def update_lesson_progress(
    lesson_id: str,
    request: UpdateProgressRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[UpdateProgressResponse]:
    """Update lesson progress."""
    user_id = current_user["user_id"]
    try:
        result = course_service.update_lesson_progress(
            db=db,
            lesson_id=lesson_id,
            user_id=user_id,
            progress_pct=request.progress_pct,
            last_position=request.last_position,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    # Award XP if lesson was completed
    if result["xp_earned"] > 0:
        award_xp(db, user_id, result["xp_earned"], reason="lesson_complete")

    # Auto-complete training plan "lesson" item when a lesson reaches 100%
    if request.progress_pct >= 100:
        try:
            from app.services import train_service
            train_service.auto_complete_item(db, user_id, "lesson")
        except Exception:
            pass

    return APIResponse.success(data=result)


@router.get("/lessons/{lesson_id}/exercises", response_model=APIResponse[list[ExerciseItem]])
def get_lesson_exercises(
    lesson_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[list[ExerciseItem]]:
    """Get exercises for a lesson."""
    user_id = current_user["user_id"]
    exercises = course_service.get_lesson_exercises(db, lesson_id, user_id)
    return APIResponse.success(data=exercises)


@router.post("/exercises/{exercise_id}/attempt", response_model=APIResponse[ExerciseAttemptResponse])
def submit_exercise_attempt(
    exercise_id: str,
    request: ExerciseAttemptRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[ExerciseAttemptResponse]:
    """Submit an exercise answer."""
    user_id = current_user["user_id"]
    try:
        result = course_service.submit_exercise_attempt(
            db=db,
            exercise_id=exercise_id,
            user_id=user_id,
            user_answer=request.user_answer,
            time_spent_ms=request.time_spent_ms,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    # Award XP
    if result["xp_earned"] > 0:
        award_xp(db, user_id, result["xp_earned"], reason="exercise_correct")

    return APIResponse.success(data=result)


@router.post("/lessons/{lesson_id}/ai-teach", response_model=APIResponse[AITeachResponse])
def ai_teach_interaction(
    lesson_id: str,
    request: AITeachRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[AITeachResponse]:
    """AI interactive teaching conversation."""
    user_id = current_user["user_id"]

    # Check AI Q&A quota
    if not consume_quota(db, user_id, "ai_qa_daily"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Daily AI Q&A limit reached",
        )

    # Consume credits for AI interactive teaching
    cost = credit_service.CREDIT_COSTS["ai_teaching"]
    balance = credit_service.get_balance(db, user_id)
    if not credit_service.consume_credits(
        db, user_id, cost, "AI互动教学", lesson_id
    ):
        return APIResponse.error(
            code=402,
            message="积分不足",
            data={"required": cost, "balance": balance},
        )

    try:
        result = course_service.ai_teach_interaction(
            db=db,
            lesson_id=lesson_id,
            user_id=user_id,
            message=request.message,
            context=request.context,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return APIResponse.success(data=result)
