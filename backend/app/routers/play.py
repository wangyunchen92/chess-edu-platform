"""Play module router (B1-1, B1-2, B1-3, B1-6)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.play import (
    CharacterDetail,
    CharacterListItem,
    CompleteGameRequest,
    CreateGameRequest,
    CreateGameResponse,
    GameDetail,
    GameListItem,
    GameReviewResponse,
)
from app.services import dialogue_service, game_service
from app.services.membership_service import consume_quota

router = APIRouter()


# ── Character endpoints ───────────────────────────────────────────


@router.get("/characters", response_model=APIResponse[list[CharacterListItem]])
def list_characters(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[list[CharacterListItem]]:
    """Get all characters with user's unlock status and stats."""
    user_id = current_user["user_id"]
    items = game_service.list_characters(db, user_id)
    return APIResponse.success(data=items)


@router.get("/characters/{character_id}", response_model=APIResponse[CharacterDetail])
def get_character_detail(
    character_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[CharacterDetail]:
    """Get character detail."""
    user_id = current_user["user_id"]
    detail = game_service.get_character_detail(db, character_id, user_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )
    return APIResponse.success(data=detail)


# ── Game endpoints ────────────────────────────────────────────────


@router.post("/games", response_model=APIResponse[CreateGameResponse])
def create_game(
    request: CreateGameRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[CreateGameResponse]:
    """Create a new game."""
    user_id = current_user["user_id"]

    # Check daily game quota
    if not consume_quota(db, user_id, "daily_games"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Daily game limit reached",
        )

    game = game_service.create_game(
        db=db,
        user_id=user_id,
        character_id=request.character_id,
        time_control=request.time_control,
    )
    return APIResponse.success(data=CreateGameResponse(game_id=game.id))


@router.put("/games/{game_id}/complete", response_model=APIResponse[GameDetail])
def complete_game(
    game_id: str,
    request: CompleteGameRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[GameDetail]:
    """Complete a game with result and PGN."""
    user_id = current_user["user_id"]

    game = game_service.complete_game(
        db=db,
        game_id=game_id,
        user_id=user_id,
        result=request.result,
        pgn=request.pgn,
        moves_count=request.moves_count,
        user_color=request.user_color,
        final_fen=request.final_fen,
    )
    if game is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found",
        )

    # Re-fetch as GameDetail for complete response
    detail = game_service.get_game_detail(db, game_id, user_id)

    # Auto-complete training plan "game" item
    try:
        from app.services import train_service
        train_service.auto_complete_item(db, user_id, "game")
    except Exception:
        pass

    return APIResponse.success(data=detail)


@router.get("/games", response_model=PaginatedResponse[GameListItem])
def list_games(
    current_user: dict = Depends(get_current_user),
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> PaginatedResponse[GameListItem]:
    """List user's game history with pagination."""
    user_id = current_user["user_id"]
    items, total = game_service.list_games(
        db=db,
        user_id=user_id,
        page=pagination.page,
        page_size=pagination.page_size,
    )
    return PaginatedResponse.create(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/games/{game_id}", response_model=APIResponse[GameDetail])
def get_game_detail(
    game_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[GameDetail]:
    """Get game detail."""
    user_id = current_user["user_id"]
    detail = game_service.get_game_detail(db, game_id, user_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found",
        )
    return APIResponse.success(data=detail)


# ── Review endpoint (B1-6) ───────────────────────────────────────


@router.get("/games/{game_id}/review", response_model=APIResponse[GameReviewResponse])
def get_game_review(
    game_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[GameReviewResponse]:
    """Get game review data (key moments, analysis)."""
    user_id = current_user["user_id"]
    detail = game_service.get_game_detail(db, game_id, user_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found",
        )
    return APIResponse.success(
        data=GameReviewResponse(
            game_id=detail.id,
            review_data=detail.review_data,
        )
    )


# ── Dialogue endpoint (B3-1, B3-2) ─────────────────────────────


@router.get("/games/{game_id}/dialogue", response_model=APIResponse[dict])
def get_game_dialogue(
    game_id: str,
    event: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[dict]:
    """Get character dialogue for a game event.

    Query parameter `event` should be one of: greeting, good_move, blunder,
    check_given, check_received, capture_given, capture_received,
    advantage, disadvantage, win, lose, draw.
    """
    user_id = current_user["user_id"]

    # Look up the game to get character_id
    detail = game_service.get_game_detail(db, game_id, user_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found",
        )

    dialogue = dialogue_service.get_dialogue(db, detail.character_id, event)
    if dialogue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found",
        )

    return APIResponse.success(data=dialogue)
