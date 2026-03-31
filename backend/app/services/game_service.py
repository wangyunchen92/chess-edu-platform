"""Game service layer (B1-4)."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.character import Character, CharacterDialogue, UserCharacterRelation
from app.models.game import Game
from app.models.gamification import UserRating
from app.schemas.play import (
    CharacterDetail,
    CharacterListItem,
    CharacterStats,
    GameDetail,
    GameListItem,
)


def list_characters(db: Session, user_id: str) -> list[CharacterListItem]:
    """List all characters with user's unlock status and stats.

    Args:
        db: Database session.
        user_id: Current user ID.

    Returns:
        List of CharacterListItem with unlock status and per-character stats.
    """
    # Fetch all characters ordered by sort_order
    stmt = select(Character).order_by(Character.sort_order)
    characters = db.execute(stmt).scalars().all()

    # Fetch user's relations with characters
    rel_stmt = select(UserCharacterRelation).where(
        UserCharacterRelation.user_id == user_id
    )
    relations = db.execute(rel_stmt).scalars().all()
    rel_map = {r.character_id: r for r in relations}

    result = []
    for char in characters:
        rel = rel_map.get(char.id)
        is_unlocked = char.is_free or (rel is not None and rel.is_unlocked)
        stats = None
        affinity = 0
        affinity_level = "stranger"
        if rel is not None:
            stats = CharacterStats(
                games_played=rel.games_played,
                games_won=rel.games_won,
                games_lost=rel.games_lost,
                games_drawn=rel.games_drawn,
            )
            affinity = rel.affinity
            affinity_level = rel.affinity_level or "stranger"
        item = CharacterListItem(
            id=char.id,
            slug=char.slug,
            name=char.name,
            tier=char.tier,
            region=char.region or "meadow",
            avatar_key=char.avatar_key,
            play_style=char.play_style,
            base_rating=char.base_rating,
            rating_range_min=char.rating_range_min,
            rating_range_max=char.rating_range_max,
            play_style_params=char.play_style_params or {},
            is_free=char.is_free,
            sort_order=char.sort_order,
            is_unlocked=is_unlocked,
            unlock_story=char.unlock_story,
            affinity=affinity,
            affinity_level=affinity_level,
            stats=stats,
        )
        result.append(item)

    return result


def get_character_detail(db: Session, character_id: str, user_id: str) -> Optional[CharacterDetail]:
    """Get character detail with user's unlock status and stats.

    Args:
        db: Database session.
        character_id: Character ID.
        user_id: Current user ID.

    Returns:
        CharacterDetail or None if not found.
    """
    stmt = select(Character).where(Character.id == character_id)
    char = db.execute(stmt).scalar_one_or_none()
    if char is None:
        return None

    rel_stmt = select(UserCharacterRelation).where(
        UserCharacterRelation.user_id == user_id,
        UserCharacterRelation.character_id == character_id,
    )
    rel = db.execute(rel_stmt).scalar_one_or_none()

    is_unlocked = char.is_free or (rel is not None and rel.is_unlocked)
    stats = None
    affinity = 0
    affinity_level = "stranger"
    if rel is not None:
        stats = CharacterStats(
            games_played=rel.games_played,
            games_won=rel.games_won,
            games_lost=rel.games_lost,
            games_drawn=rel.games_drawn,
        )
        affinity = rel.affinity
        affinity_level = rel.affinity_level or "stranger"

    # Load dialogues grouped by scene
    dial_stmt = (
        select(CharacterDialogue)
        .where(CharacterDialogue.character_id == character_id)
        .order_by(CharacterDialogue.scene, CharacterDialogue.sort_order)
    )
    dial_rows = db.execute(dial_stmt).scalars().all()
    dialogues: dict[str, list[str]] = {}
    for d in dial_rows:
        dialogues.setdefault(d.scene, []).append(d.content)

    return CharacterDetail(
        id=char.id,
        slug=char.slug,
        name=char.name,
        tier=char.tier,
        region=char.region or "meadow",
        avatar_key=char.avatar_key,
        personality=char.personality,
        play_style=char.play_style,
        base_rating=char.base_rating,
        rating_range_min=char.rating_range_min,
        rating_range_max=char.rating_range_max,
        engine_depth_min=char.engine_depth_min,
        engine_depth_max=char.engine_depth_max,
        mistake_rate=float(char.mistake_rate),
        play_style_params=char.play_style_params or {},
        unlock_condition=char.unlock_condition or {},
        is_free=char.is_free,
        sort_order=char.sort_order,
        is_unlocked=is_unlocked,
        unlock_story=char.unlock_story,
        affinity=affinity,
        affinity_level=affinity_level,
        stats=stats,
        dialogues=dialogues,
    )


def create_game(
    db: Session,
    user_id: str,
    character_id: str,
    time_control: int,
) -> Game:
    """Create a new game.

    Args:
        db: Database session.
        user_id: Current user ID.
        character_id: Character to play against.
        time_control: Time control in seconds.

    Returns:
        Newly created Game.
    """
    from app.services.adaptive_service import get_effective_params

    # Get character to record AI rating
    char_stmt = select(Character).where(Character.id == character_id)
    character = db.execute(char_stmt).scalar_one_or_none()
    ai_rating = character.base_rating if character else 300

    # Get adaptive parameters
    adaptive_params = get_effective_params(db, user_id, character_id)
    if adaptive_params:
        ai_rating = adaptive_params.get("effective_rating", ai_rating)
        difficulty_mode = adaptive_params.get("difficulty_mode", "normal")
    else:
        difficulty_mode = "normal"
        adaptive_params = None

    # Get user's current rating
    rating_stmt = select(UserRating).where(UserRating.user_id == user_id)
    user_rating = db.execute(rating_stmt).scalar_one_or_none()
    current_rating = user_rating.game_rating if user_rating else 300

    game = Game(
        id=str(uuid.uuid4()),
        user_id=user_id,
        character_id=character_id,
        time_control=time_control,
        status="playing",
        user_rating_before=current_rating,
        ai_rating_used=ai_rating,
        difficulty_mode=difficulty_mode,
        adaptive_params=adaptive_params if adaptive_params else None,
        started_at=datetime.now(timezone.utc),
    )
    db.add(game)
    db.flush()
    return game


def complete_game(
    db: Session,
    game_id: str,
    user_id: str,
    result: str,
    pgn: Optional[str] = None,
    moves_count: Optional[int] = None,
    user_color: str = "white",
    final_fen: Optional[str] = None,
) -> Optional[Game]:
    """Complete a game and trigger rating update.

    Args:
        db: Database session.
        game_id: Game ID.
        user_id: Current user ID.
        result: Game result (win, loss, draw).
        pgn: PGN notation.
        moves_count: Total move count.
        user_color: User's color.
        final_fen: Final FEN position.

    Returns:
        Updated Game or None if not found.
    """
    from app.services.gamification_service import update_rating_after_game

    stmt = select(Game).where(Game.id == game_id, Game.user_id == user_id)
    game = db.execute(stmt).scalar_one_or_none()
    if game is None:
        return None

    if game.status != "playing":
        return game  # Already completed

    # Map result string to actual score
    score_map = {"win": 1.0, "loss": 0.0, "draw": 0.5}
    actual_score = score_map.get(result, 0.0)

    # Update game fields
    game.result = result
    game.pgn = pgn
    game.total_moves = moves_count
    game.user_color = user_color
    game.final_fen = final_fen
    game.status = "completed"
    game.ended_at = datetime.now(timezone.utc)

    # Update rating
    opponent_rating = game.ai_rating_used or 300
    new_rating, change = update_rating_after_game(
        db=db,
        user_id=user_id,
        opponent_rating=opponent_rating,
        result=actual_score,
        is_ai=True,
        source_id=game_id,
    )
    game.user_rating_after = new_rating
    game.rating_change = change

    # Update user-character relation stats
    _update_character_stats(db, user_id, game.character_id, result)

    # Update adaptive difficulty after game
    try:
        from app.services.adaptive_service import update_after_game
        adaptive_snapshot = update_after_game(db, user_id, game.character_id, result)
        game.adaptive_params = adaptive_snapshot
        game.difficulty_mode = adaptive_snapshot.get("difficulty_mode", "normal")
    except Exception:
        pass  # Non-critical: don't fail game completion if adaptive update fails

    # Trigger incremental weakness analysis (non-critical)
    try:
        from app.services.diagnosis_service import analyze
        analyze(db, user_id, force=False)
    except Exception:
        pass

    db.add(game)
    db.flush()
    return game


def _update_character_stats(
    db: Session,
    user_id: str,
    character_id: str,
    result: str,
) -> None:
    """Update UserCharacterRelation stats after a game."""
    stmt = select(UserCharacterRelation).where(
        UserCharacterRelation.user_id == user_id,
        UserCharacterRelation.character_id == character_id,
    )
    rel = db.execute(stmt).scalar_one_or_none()

    if rel is None:
        rel = UserCharacterRelation(
            id=str(uuid.uuid4()),
            user_id=user_id,
            character_id=character_id,
            is_unlocked=True,
            games_played=0,
            games_won=0,
            games_lost=0,
            games_drawn=0,
        )
        db.add(rel)
        db.flush()

    rel.games_played = (rel.games_played or 0) + 1
    if result == "win":
        rel.games_won = (rel.games_won or 0) + 1
    elif result == "loss":
        rel.games_lost = (rel.games_lost or 0) + 1
    elif result == "draw":
        rel.games_drawn = (rel.games_drawn or 0) + 1

    # Update affinity: +10 per game, +5 bonus for win
    rel.affinity = (rel.affinity or 0) + 10
    if result == "win":
        rel.affinity += 5

    # Update affinity_level based on new affinity value
    affinity = rel.affinity or 0
    if affinity >= 500:
        rel.affinity_level = "best_friend"
    elif affinity >= 300:
        rel.affinity_level = "trusted"
    elif affinity >= 150:
        rel.affinity_level = "familiar"
    elif affinity >= 50:
        rel.affinity_level = "acquainted"
    else:
        rel.affinity_level = "stranger"

    db.add(rel)


def list_games(
    db: Session,
    user_id: str,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[GameListItem], int]:
    """List user's games with pagination.

    Args:
        db: Database session.
        user_id: Current user ID.
        page: Page number.
        page_size: Items per page.

    Returns:
        Tuple of (list of GameListItem, total count).
    """
    # Count total
    count_stmt = select(func.count()).select_from(Game).where(Game.user_id == user_id)
    total = db.execute(count_stmt).scalar() or 0

    # Fetch page
    offset = (page - 1) * page_size
    stmt = (
        select(Game)
        .where(Game.user_id == user_id)
        .order_by(Game.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    games = db.execute(stmt).scalars().all()

    # Get character info for display
    char_ids = list({g.character_id for g in games})
    char_map: dict[str, Character] = {}
    if char_ids:
        char_stmt = select(Character).where(Character.id.in_(char_ids))
        chars = db.execute(char_stmt).scalars().all()
        char_map = {c.id: c for c in chars}

    items = []
    for g in games:
        char = char_map.get(g.character_id)
        items.append(
            GameListItem(
                id=g.id,
                character_id=g.character_id,
                character_name=char.name if char else None,
                character_avatar_key=char.avatar_key if char else None,
                user_color=g.user_color,
                time_control=g.time_control,
                status=g.status,
                result=g.result,
                total_moves=g.total_moves,
                rating_change=g.rating_change,
                user_rating_before=g.user_rating_before,
                user_rating_after=g.user_rating_after,
                started_at=g.started_at,
                ended_at=g.ended_at,
            )
        )

    return items, total


def get_game_detail(db: Session, game_id: str, user_id: str) -> Optional[GameDetail]:
    """Get game detail.

    Args:
        db: Database session.
        game_id: Game ID.
        user_id: Current user ID.

    Returns:
        GameDetail or None.
    """
    stmt = select(Game).where(Game.id == game_id, Game.user_id == user_id)
    game = db.execute(stmt).scalar_one_or_none()
    if game is None:
        return None

    char_stmt = select(Character).where(Character.id == game.character_id)
    char = db.execute(char_stmt).scalar_one_or_none()

    return GameDetail(
        id=game.id,
        user_id=game.user_id,
        character_id=game.character_id,
        character_name=char.name if char else None,
        character_avatar_key=char.avatar_key if char else None,
        user_color=game.user_color,
        time_control=game.time_control,
        time_increment=game.time_increment,
        status=game.status,
        result=game.result,
        result_reason=game.result_reason,
        pgn=game.pgn,
        final_fen=game.final_fen,
        total_moves=game.total_moves,
        user_rating_before=game.user_rating_before,
        user_rating_after=game.user_rating_after,
        rating_change=game.rating_change,
        ai_rating_used=game.ai_rating_used,
        hints_used=game.hints_used,
        review_data=game.review_data,
        started_at=game.started_at,
        ended_at=game.ended_at,
        created_at=game.created_at,
    )
