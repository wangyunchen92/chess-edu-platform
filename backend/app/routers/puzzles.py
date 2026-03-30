"""Puzzles module router (B2-1 & B2-2)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import APIResponse
from app.schemas.puzzles import (
    ChallengeProgressResponse,
    ChallengePuzzleItem,
    DailyPuzzlesResponse,
    MistakeListResponse,
    PuzzleAttemptRequest,
    PuzzleAttemptResponse,
    PuzzleItem,
    PuzzleStatsResponse,
)
from app.services import puzzle_service
from app.services.gamification_service import award_xp
from app.services.membership_service import consume_quota, get_daily_quota

router = APIRouter()


@router.get("/daily", response_model=APIResponse[DailyPuzzlesResponse])
def get_daily_puzzles(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[DailyPuzzlesResponse]:
    """Get today's 3 daily puzzles."""
    user_id = current_user["user_id"]
    data = puzzle_service.get_daily_puzzles(db, user_id)
    quota = get_daily_quota(db, user_id, "daily_puzzles")
    data["quota"] = quota
    return APIResponse.success(data=data)


@router.get("/challenge", response_model=APIResponse[ChallengeProgressResponse])
def get_challenge_progress(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[ChallengeProgressResponse]:
    """Get challenge progress across all difficulty levels."""
    user_id = current_user["user_id"]
    levels = puzzle_service.get_challenge_progress(db, user_id)
    return APIResponse.success(data={"levels": levels})


@router.get("/challenge/{level}", response_model=APIResponse[list[ChallengePuzzleItem]])
def get_challenge_level_puzzles(
    level: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[list[ChallengePuzzleItem]]:
    """Get puzzles for a specific challenge level."""
    if level < 1 or level > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Level must be between 1 and 5",
        )
    user_id = current_user["user_id"]
    puzzles = puzzle_service.get_challenge_puzzles(db, user_id, level)
    return APIResponse.success(data=puzzles)


@router.get("/mistakes", response_model=APIResponse[MistakeListResponse])
def get_mistakes(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[MistakeListResponse]:
    """Get mistake book (recent 10 incorrect puzzles)."""
    user_id = current_user["user_id"]
    data = puzzle_service.get_mistakes(db, user_id, limit=10)
    return APIResponse.success(data=data)


@router.get("/stats", response_model=APIResponse[PuzzleStatsResponse])
def get_puzzle_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[PuzzleStatsResponse]:
    """Get puzzle statistics."""
    user_id = current_user["user_id"]
    data = puzzle_service.get_puzzle_stats(db, user_id)
    return APIResponse.success(data=data)


@router.get("/{puzzle_id}", response_model=APIResponse[PuzzleItem])
def get_puzzle(
    puzzle_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[PuzzleItem]:
    """Get a single puzzle by ID."""
    data = puzzle_service.get_puzzle_by_id(db, puzzle_id)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Puzzle not found",
        )
    return APIResponse.success(data=data)


@router.post("/{puzzle_id}/attempt", response_model=APIResponse[PuzzleAttemptResponse])
def submit_puzzle_attempt(
    puzzle_id: str,
    request: PuzzleAttemptRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[PuzzleAttemptResponse]:
    """Submit a puzzle attempt."""
    user_id = current_user["user_id"]

    # Check daily puzzle quota for daily puzzles
    if request.source == "daily":
        if not consume_quota(db, user_id, "daily_puzzles"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Daily puzzle limit reached",
            )

    try:
        result = puzzle_service.submit_attempt(
            db=db,
            user_id=user_id,
            puzzle_id=puzzle_id,
            user_moves=request.user_moves,
            is_correct=request.is_correct,
            time_spent_ms=request.time_spent_ms,
            hint_used=request.hint_used,
            source=request.source,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    # Award XP
    if result["xp_earned"] > 0:
        award_xp(db, user_id, result["xp_earned"], reason="puzzle_attempt")

    # Auto-complete training plan "puzzle" item if daily puzzles are done
    if request.source == "daily":
        try:
            from app.services import train_service
            quota = get_daily_quota(db, user_id, "daily_puzzles")
            if quota["limit"] != -1 and quota["remaining"] <= 0:
                train_service.auto_complete_item(db, user_id, "puzzle")
        except Exception:
            pass  # best-effort, don't fail the puzzle submission

    return APIResponse.success(data=result)
