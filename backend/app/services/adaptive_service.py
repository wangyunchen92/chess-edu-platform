"""Adaptive difficulty service (Phase 2a F4).

Manages per-user-per-character adaptive difficulty configurations.
Adjusts AI parameters based on recent win rate to maintain 40-60% target.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models.adaptive import AdaptiveDifficultyConfig
from app.models.character import Character
from app.schemas.play import (
    AdaptiveAdjustmentDetail,
    AdaptiveDifficultyResponse,
)

# Limits
MAX_RATING_OFFSET = 200
MIN_RATING_OFFSET = -200
MAX_DEPTH_ADJ = 3
MIN_DEPTH_ADJ = -3
MAX_MISTAKE_ADJ = 0.15
MIN_MISTAKE_ADJ = -0.15

# Target win rate window
WIN_RATE_HIGH = 0.60
WIN_RATE_LOW = 0.40

# Adjustment step sizes
RATING_STEP = 25
DEPTH_STEP = 1
MISTAKE_STEP = 0.03

# Max recent results to keep
MAX_RECENT_RESULTS = 10


def get_adaptive_status(
    db: Session, user_id: str, character_id: str
) -> Optional[AdaptiveDifficultyResponse]:
    """Get the adaptive difficulty status for a user-character pair."""
    char = db.execute(
        select(Character).where(Character.id == character_id)
    ).scalar_one_or_none()
    if char is None:
        return None

    config = _get_or_create_config(db, user_id, character_id)

    effective_rating = char.base_rating + config.current_rating_offset
    # Determine difficulty mode
    offset = config.current_rating_offset
    if offset > 0:
        difficulty_mode = "hard"
    elif offset < 0:
        difficulty_mode = "easy"
    else:
        difficulty_mode = "normal"

    return AdaptiveDifficultyResponse(
        character_id=character_id,
        character_name=char.name,
        base_rating=char.base_rating,
        effective_rating=effective_rating,
        difficulty_mode=difficulty_mode,
        recent_win_rate=float(config.recent_win_rate),
        recent_results=config.recent_results or [],
        adjustment_detail=AdaptiveAdjustmentDetail(
            rating_offset=config.current_rating_offset,
            depth_adjustment=config.current_depth_adjustment,
            mistake_rate_adjustment=float(config.current_mistake_rate_adjustment),
        ),
    )


def get_effective_params(
    db: Session, user_id: str, character_id: str
) -> dict:
    """Get the effective engine parameters for a game, combining base + adaptive.

    Returns a dict with keys:
        effective_depth_min, effective_depth_max,
        effective_mistake_rate, effective_rating, difficulty_mode,
        rating_offset, recent_win_rate, recent_games_count
    """
    char = db.execute(
        select(Character).where(Character.id == character_id)
    ).scalar_one_or_none()
    if char is None:
        return {}

    config = _get_or_create_config(db, user_id, character_id)

    depth_adj = config.current_depth_adjustment
    mistake_adj = float(config.current_mistake_rate_adjustment)
    rating_offset = config.current_rating_offset

    eff_depth_min = max(1, char.engine_depth_min + depth_adj)
    eff_depth_max = max(1, char.engine_depth_max + depth_adj)
    eff_mistake_rate = max(0.0, min(0.5, float(char.mistake_rate) + mistake_adj))
    eff_rating = char.base_rating + rating_offset

    offset = rating_offset
    if offset > 0:
        difficulty_mode = "hard"
    elif offset < 0:
        difficulty_mode = "easy"
    else:
        difficulty_mode = "normal"

    return {
        "adjusted_depth_min": eff_depth_min,
        "adjusted_depth_max": eff_depth_max,
        "adjusted_mistake_rate": round(eff_mistake_rate, 2),
        "rating_offset": rating_offset,
        "effective_rating": eff_rating,
        "difficulty_mode": difficulty_mode,
        "recent_win_rate": float(config.recent_win_rate),
        "recent_games_count": len(config.recent_results or []),
    }


def update_after_game(
    db: Session, user_id: str, character_id: str, result: str
) -> dict:
    """Update adaptive difficulty after a game completes.

    Args:
        result: "win", "loss", or "draw"

    Returns:
        The adaptive_params snapshot to store in games table.
    """
    config = _get_or_create_config(db, user_id, character_id)

    # Push result to recent_results (keep last MAX_RECENT_RESULTS)
    results = list(config.recent_results or [])
    results.append(result)
    if len(results) > MAX_RECENT_RESULTS:
        results = results[-MAX_RECENT_RESULTS:]
    config.recent_results = results
    flag_modified(config, "recent_results")

    # Recalculate win rate
    if results:
        wins = sum(1 for r in results if r == "win")
        draws = sum(1 for r in results if r == "draw")
        win_rate = (wins + 0.5 * draws) / len(results)
    else:
        win_rate = 0.5

    config.recent_win_rate = round(win_rate, 2)

    # Apply adjustment
    if win_rate > WIN_RATE_HIGH:
        # User winning too much, make AI stronger
        config.current_rating_offset = min(
            MAX_RATING_OFFSET, config.current_rating_offset + RATING_STEP
        )
        config.current_depth_adjustment = min(
            MAX_DEPTH_ADJ, config.current_depth_adjustment + DEPTH_STEP
        )
        config.current_mistake_rate_adjustment = max(
            MIN_MISTAKE_ADJ,
            round(float(config.current_mistake_rate_adjustment) - MISTAKE_STEP, 2),
        )
    elif win_rate < WIN_RATE_LOW:
        # User losing too much, make AI weaker
        config.current_rating_offset = max(
            MIN_RATING_OFFSET, config.current_rating_offset - RATING_STEP
        )
        config.current_depth_adjustment = max(
            MIN_DEPTH_ADJ, config.current_depth_adjustment - DEPTH_STEP
        )
        config.current_mistake_rate_adjustment = min(
            MAX_MISTAKE_ADJ,
            round(float(config.current_mistake_rate_adjustment) + MISTAKE_STEP, 2),
        )
    # else: win_rate in [0.40, 0.60] — no adjustment

    config.adjustment_count += 1
    config.last_adjusted_at = datetime.now(timezone.utc)
    db.add(config)
    db.flush()

    # Get character for snapshot
    char = db.execute(
        select(Character).where(Character.id == character_id)
    ).scalar_one_or_none()

    # Determine difficulty mode
    offset = config.current_rating_offset
    if offset > 0:
        difficulty_mode = "hard"
    elif offset < 0:
        difficulty_mode = "easy"
    else:
        difficulty_mode = "normal"

    return {
        "adjusted_depth_min": max(1, (char.engine_depth_min if char else 3) + config.current_depth_adjustment),
        "adjusted_depth_max": max(1, (char.engine_depth_max if char else 5) + config.current_depth_adjustment),
        "adjusted_mistake_rate": round(
            max(0.0, min(0.5, float(char.mistake_rate if char else 0.3) + float(config.current_mistake_rate_adjustment))), 2
        ),
        "rating_offset": config.current_rating_offset,
        "recent_win_rate": float(config.recent_win_rate),
        "recent_games_count": len(config.recent_results or []),
        "difficulty_mode": difficulty_mode,
    }


def _get_or_create_config(
    db: Session, user_id: str, character_id: str
) -> AdaptiveDifficultyConfig:
    """Get existing config or create a new one."""
    stmt = select(AdaptiveDifficultyConfig).where(
        AdaptiveDifficultyConfig.user_id == user_id,
        AdaptiveDifficultyConfig.character_id == character_id,
    )
    config = db.execute(stmt).scalar_one_or_none()
    if config is None:
        config = AdaptiveDifficultyConfig(
            id=str(uuid.uuid4()),
            user_id=user_id,
            character_id=character_id,
            recent_results=[],
            recent_win_rate=0.50,
            current_rating_offset=0,
            current_depth_adjustment=0,
            current_mistake_rate_adjustment=0.00,
            adjustment_count=0,
        )
        db.add(config)
        db.flush()
    return config
