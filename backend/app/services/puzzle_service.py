"""Puzzle service layer (B2-1 & B2-2)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, case, cast, func, select
from sqlalchemy.orm import Session

from app.models.gamification import RatingHistory, UserRating
from app.models.puzzle import DailyPuzzle, Puzzle, PuzzleAttempt
from app.utils.elo import calculate_puzzle_rating


def _get_user_puzzle_rating(db: Session, user_id: str) -> int:
    """Get user's current puzzle rating, default 300."""
    user_rating = db.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    ).scalar_one_or_none()
    return user_rating.puzzle_rating if user_rating else 300


def _pick_puzzles_by_rating(
    db: Session, user_id: str, count: int = 3, theme: str | None = None,
) -> list:
    """Pick puzzles matched to user's puzzle_rating.

    Strategy:
    1. Query within ±200 of user rating, exclude already-attempted puzzles
    2. If not enough, widen to ±400
    3. If still not enough, fall back to random from daily pool
    """
    user_pr = _get_user_puzzle_rating(db, user_id)

    # Get puzzle IDs the user has already attempted (any source)
    attempted_ids_stmt = (
        select(PuzzleAttempt.puzzle_id)
        .where(PuzzleAttempt.user_id == user_id)
        .distinct()
    )
    attempted_ids = set(
        row[0] for row in db.execute(attempted_ids_stmt).all()
    )

    for spread in (200, 400, 800, None):
        base = select(Puzzle).where(Puzzle.is_daily_pool.is_(True))

        if spread is not None:
            base = base.where(
                Puzzle.rating >= user_pr - spread,
                Puzzle.rating <= user_pr + spread,
            )

        if theme:
            base = base.where(Puzzle.themes.contains(theme))

        if attempted_ids:
            base = base.where(Puzzle.id.notin_(attempted_ids))

        base = base.order_by(func.random()).limit(count)
        results = db.execute(base).scalars().all()

        if len(results) >= count:
            return results[:count]

        # If we got some but not enough, keep them and try wider
        if results and spread is None:
            return results

    # Absolute fallback: random from entire pool (allow repeats)
    fallback = (
        select(Puzzle)
        .where(Puzzle.is_daily_pool.is_(True))
        .order_by(func.random())
        .limit(count)
    )
    return db.execute(fallback).scalars().all()


def get_daily_puzzles(db: Session, user_id: str) -> dict:
    """Get or generate today's 3 daily puzzles matched to user's rating."""
    today = date.today()

    # Check if this user already has daily puzzles for today
    stmt = (
        select(DailyPuzzle)
        .where(
            DailyPuzzle.puzzle_date == today,
            DailyPuzzle.user_id == user_id,
        )
        .order_by(DailyPuzzle.sort_order)
    )
    daily_records = db.execute(stmt).scalars().all()

    if not daily_records:
        # Generate personalized puzzles based on user's puzzle rating
        pool_puzzles = _pick_puzzles_by_rating(db, user_id, count=3)

        new_records = []
        for i, puzzle in enumerate(pool_puzzles):
            dp = DailyPuzzle(
                id=str(uuid.uuid4()),
                puzzle_date=today,
                puzzle_id=puzzle.id,
                sort_order=i + 1,
                user_id=user_id,
            )
            db.add(dp)
            new_records.append(dp)
        db.flush()
        daily_records = new_records

    # Get user attempts for these puzzles today
    puzzle_ids = [dp.puzzle_id for dp in daily_records]
    attempts_stmt = select(PuzzleAttempt).where(
        PuzzleAttempt.user_id == user_id,
        PuzzleAttempt.puzzle_id.in_(puzzle_ids),
        PuzzleAttempt.source == "daily",
    )
    attempts = db.execute(attempts_stmt).scalars().all()
    attempt_map = {a.puzzle_id: a for a in attempts}

    # Load puzzle objects
    puzzles_stmt = select(Puzzle).where(Puzzle.id.in_(puzzle_ids))
    puzzles = db.execute(puzzles_stmt).scalars().all()
    puzzle_map = {p.id: p for p in puzzles}

    items = []
    for dp in daily_records:
        puzzle = puzzle_map.get(dp.puzzle_id)
        if puzzle is None:
            continue
        attempt = attempt_map.get(dp.puzzle_id)
        items.append({
            "puzzle": _puzzle_to_dict(puzzle),
            "sort_order": dp.sort_order,
            "attempted": attempt is not None,
            "is_correct": attempt.is_correct if attempt else None,
        })

    return {
        "date": today.isoformat(),
        "puzzles": items,
    }


DIFFICULTY_RATING_RANGES = {
    1: (0, 800),
    2: (800, 1200),
    3: (1200, 1600),
    4: (1600, 2000),
    5: (2000, 9999),
}


def get_theme_puzzles(
    db: Session, user_id: str, theme: str, count: int = 10, difficulty: int | None = None,
) -> list[dict]:
    """Get puzzles for a specific theme.

    If difficulty is provided (1-5), filter by rating range.
    Otherwise, match to user's rating.
    """
    if difficulty and difficulty in DIFFICULTY_RATING_RANGES:
        rating_min, rating_max = DIFFICULTY_RATING_RANGES[difficulty]
        stmt = (
            select(Puzzle)
            .where(
                Puzzle.themes.ilike(f"%{theme}%"),
                Puzzle.rating >= rating_min,
                Puzzle.rating < rating_max,
            )
            .order_by(Puzzle.rating, Puzzle.id)
            .limit(count)
        )
        puzzles = db.execute(stmt).scalars().all()
    else:
        puzzles = _pick_puzzles_by_rating(db, user_id, count=count, theme=theme)

    # Batch-query user's correct attempts for these puzzles
    puzzle_ids = [p.id for p in puzzles]
    solved_ids: set[str] = set()
    if puzzle_ids:
        solved_rows = db.execute(
            select(PuzzleAttempt.puzzle_id)
            .where(
                PuzzleAttempt.user_id == user_id,
                PuzzleAttempt.puzzle_id.in_(puzzle_ids),
                PuzzleAttempt.is_correct.is_(True),
            )
            .distinct()
        ).scalars().all()
        solved_ids = set(solved_rows)

    results = []
    for p in puzzles:
        d = _puzzle_to_dict(p)
        d["solved"] = p.id in solved_ids
        results.append(d)
    return results


def get_available_themes(db: Session) -> list[dict]:
    """Get all available themes with puzzle counts.

    For future theme-based training feature.
    """
    all_puzzles = db.execute(
        select(Puzzle.themes).where(Puzzle.themes.isnot(None))
    ).scalars().all()

    theme_counts: dict[str, int] = {}
    for themes_str in all_puzzles:
        if not themes_str:
            continue
        for t in themes_str.split(","):
            t = t.strip()
            if t:
                theme_counts[t] = theme_counts.get(t, 0) + 1

    # Theme display names
    THEME_NAMES = {
        "fork": "双攻", "pin": "牵制", "skewer": "串击",
        "discoveredAttack": "闪击", "doubleCheck": "双将",
        "sacrifice": "弃子", "deflection": "引离", "decoy": "引入",
        "hangingPiece": "悬子", "trappedPiece": "困子",
        "intermezzo": "中间着", "quietMove": "安静着",
        "defensiveMove": "防守着", "xRayAttack": "X光攻击",
        "mate": "将杀", "mateIn1": "一步杀", "mateIn2": "两步杀",
        "mateIn3": "三步杀", "backRankMate": "底线杀",
        "smotheredMate": "闷杀", "hookMate": "钩杀",
        "opening": "开局", "middlegame": "中局", "endgame": "残局",
        "rookEndgame": "车残局", "queenEndgame": "后残局",
        "pawnEndgame": "兵残局", "bishopEndgame": "象残局",
        "knightEndgame": "马残局",
        "crushing": "碾压", "advantage": "优势",
        "promotion": "升变", "castling": "王车易位",
        "kingsideAttack": "王翼攻击", "queensideAttack": "后翼攻击",
        "exposedKing": "暴露王", "capturingDefender": "吃掉防守者",
    }

    results = []
    for theme, count in sorted(theme_counts.items(), key=lambda x: -x[1]):
        if count < 10:  # Skip very rare themes
            continue
        results.append({
            "theme": theme,
            "name": THEME_NAMES.get(theme, theme),
            "count": count,
        })

    return results


THEME_CATEGORIES = {
    "basic_tactics": {
        "name": "基础战术",
        "themes": [
            "fork", "pin", "skewer", "discoveredAttack", "doubleCheck",
            "hangingPiece", "trappedPiece",
        ],
    },
    "checkmate": {
        "name": "将杀训练",
        "themes": [
            "mateIn1", "mateIn2", "mateIn3", "backRankMate",
            "smotheredMate", "hookMate", "mate",
        ],
    },
    "advanced_tactics": {
        "name": "高级战术",
        "themes": [
            "sacrifice", "deflection", "decoy", "intermezzo",
            "quietMove", "xRayAttack", "capturingDefender",
        ],
    },
    "endgame": {
        "name": "残局训练",
        "themes": [
            "pawnEndgame", "rookEndgame", "queenEndgame",
            "bishopEndgame", "knightEndgame", "endgame",
        ],
    },
}


def get_available_themes_with_progress(db: Session, user_id: str) -> list[dict]:
    """Get all available themes with user progress (attempted/correct/accuracy)."""
    # 1. Get all themes and counts (reuse existing logic)
    themes = get_available_themes(db)
    theme_map = {t["theme"]: t for t in themes}

    # 2. Batch query user attempts grouped by puzzle themes
    attempts = db.execute(
        select(
            Puzzle.themes,
            func.count(PuzzleAttempt.id).label("attempted"),
            func.sum(case((PuzzleAttempt.is_correct == True, 1), else_=0)).label("correct"),
        )
        .join(Puzzle, Puzzle.id == PuzzleAttempt.puzzle_id)
        .where(PuzzleAttempt.user_id == user_id)
        .group_by(Puzzle.themes)
    ).all()

    # Aggregate per-theme stats (a puzzle may have multiple theme tags)
    theme_stats: dict[str, dict] = {}
    for row in attempts:
        if not row.themes:
            continue
        for t in row.themes.split(","):
            t = t.strip()
            if t not in theme_stats:
                theme_stats[t] = {"attempted": 0, "correct": 0}
            theme_stats[t]["attempted"] += row.attempted or 0
            theme_stats[t]["correct"] += row.correct or 0

    # 3. Build category lookup
    theme_to_category: dict[str, str] = {}
    for cat_key, cat_info in THEME_CATEGORIES.items():
        for t in cat_info["themes"]:
            theme_to_category[t] = cat_key

    # 4. Merge results
    results = []
    for t in themes:
        stats = theme_stats.get(t["theme"], {})
        attempted = stats.get("attempted", 0)
        correct = stats.get("correct", 0)
        results.append({
            **t,
            "category": theme_to_category.get(t["theme"], "other"),
            "attempted": attempted,
            "correct": correct,
            "accuracy": round(correct / attempted * 100) if attempted > 0 else 0,
        })

    return results


CHALLENGE_PUZZLES_PER_LEVEL = 20
CHALLENGE_TOTAL_LEVELS = 10


def _get_challenge_puzzle_ids_for_level(db: Session, level: int) -> list[str]:
    """Get puzzle IDs for a specific challenge level (1-10).

    All challenge puzzles are sorted by rating, then split into 10 equal segments.
    Each level gets 20 puzzles from its segment.
    """
    # Get all challenge puzzle IDs sorted by rating
    all_ids_stmt = (
        select(Puzzle.id)
        .where(Puzzle.is_challenge.is_(True))
        .order_by(Puzzle.rating, Puzzle.id)
    )
    all_ids = [r[0] for r in db.execute(all_ids_stmt).all()]

    if not all_ids:
        return []

    total = len(all_ids)
    segment_size = total // CHALLENGE_TOTAL_LEVELS
    start = (level - 1) * segment_size
    # Take CHALLENGE_PUZZLES_PER_LEVEL from this segment
    segment = all_ids[start:start + segment_size]
    return segment[:CHALLENGE_PUZZLES_PER_LEVEL]


def get_challenge_progress(db: Session, user_id: str) -> list[dict]:
    """Get challenge progress across 10 levels, 20 puzzles each."""
    levels = []
    for level in range(1, CHALLENGE_TOTAL_LEVELS + 1):
        puzzle_ids = _get_challenge_puzzle_ids_for_level(db, level)
        total = len(puzzle_ids)

        if total == 0:
            solved = 0
        else:
            solved_stmt = (
                select(func.count(func.distinct(PuzzleAttempt.puzzle_id)))
                .where(
                    PuzzleAttempt.user_id == user_id,
                    PuzzleAttempt.is_correct.is_(True),
                    PuzzleAttempt.source == "challenge",
                    PuzzleAttempt.puzzle_id.in_(puzzle_ids),
                )
            )
            solved = db.execute(solved_stmt).scalar() or 0

        pct = int(solved / total * 100) if total > 0 else 0
        levels.append({
            "level": level,
            "total_puzzles": total,
            "solved_puzzles": solved,
            "progress_pct": pct,
        })

    return levels


def get_challenge_puzzles(db: Session, user_id: str, level: int) -> list[dict]:
    """Get 20 puzzles for a specific challenge level with attempt status."""
    puzzle_ids = _get_challenge_puzzle_ids_for_level(db, level)
    if not puzzle_ids:
        return []

    stmt = (
        select(Puzzle)
        .where(Puzzle.id.in_(puzzle_ids))
        .order_by(Puzzle.rating, Puzzle.id)
    )
    puzzles = db.execute(stmt).scalars().all()

    if not puzzles:
        return []

    puzzle_ids = [p.id for p in puzzles]
    attempts_stmt = select(PuzzleAttempt).where(
        PuzzleAttempt.user_id == user_id,
        PuzzleAttempt.puzzle_id.in_(puzzle_ids),
        PuzzleAttempt.source == "challenge",
    )
    attempts = db.execute(attempts_stmt).scalars().all()
    # Keep best attempt per puzzle
    attempt_map: dict[str, PuzzleAttempt] = {}
    for a in attempts:
        existing = attempt_map.get(a.puzzle_id)
        if existing is None or (a.is_correct and not existing.is_correct):
            attempt_map[a.puzzle_id] = a

    items = []
    for p in puzzles:
        d = _puzzle_to_dict(p)
        attempt = attempt_map.get(p.id)
        d["attempted"] = attempt is not None
        d["is_correct"] = attempt.is_correct if attempt else None
        items.append(d)

    return items


def get_puzzle_by_id(db: Session, puzzle_id: str) -> dict | None:
    """Get a single puzzle by ID."""
    stmt = select(Puzzle).where(Puzzle.id == puzzle_id)
    puzzle = db.execute(stmt).scalar_one_or_none()
    if puzzle is None:
        return None
    return _puzzle_to_dict(puzzle)


def submit_attempt(
    db: Session,
    user_id: str,
    puzzle_id: str,
    user_moves: str,
    is_correct: bool,
    time_spent_ms: int | None = None,
    hint_used: bool = False,
    source: str = "challenge",
) -> dict:
    """Record puzzle attempt and update puzzle rating."""
    # Get puzzle
    puzzle = db.execute(
        select(Puzzle).where(Puzzle.id == puzzle_id)
    ).scalar_one_or_none()
    if puzzle is None:
        raise ValueError("Puzzle not found")

    # Get or create user rating
    user_rating = db.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    ).scalar_one_or_none()

    if user_rating is None:
        user_rating = UserRating(
            id=str(uuid.uuid4()),
            user_id=user_id,
        )
        db.add(user_rating)
        db.flush()

    old_puzzle_rating = user_rating.puzzle_rating

    # Calculate new puzzle rating
    new_rating, change = calculate_puzzle_rating(
        player_rating=old_puzzle_rating,
        puzzle_rating=puzzle.rating,
        is_correct=is_correct,
    )

    # Update user puzzle rating
    user_rating.puzzle_rating = new_rating
    db.add(user_rating)

    # Count prior attempts for this puzzle
    count_stmt = select(func.count()).select_from(PuzzleAttempt).where(
        PuzzleAttempt.user_id == user_id,
        PuzzleAttempt.puzzle_id == puzzle_id,
    )
    attempt_count = (db.execute(count_stmt).scalar() or 0) + 1

    # Create attempt record
    attempt = PuzzleAttempt(
        id=str(uuid.uuid4()),
        user_id=user_id,
        puzzle_id=puzzle_id,
        is_correct=is_correct,
        user_moves=user_moves,
        attempt_count=attempt_count,
        time_spent_ms=time_spent_ms,
        hint_used=hint_used,
        rating_before=old_puzzle_rating,
        rating_after=new_rating,
        rating_change=change,
        source=source,
    )
    db.add(attempt)

    # Record rating history
    history = RatingHistory(
        id=str(uuid.uuid4()),
        user_id=user_id,
        rating_type="puzzle",
        old_rating=old_puzzle_rating,
        new_rating=new_rating,
        change_amount=change,
        source_type="puzzle",
        source_id=puzzle_id,
    )
    db.add(history)
    db.flush()

    # XP: award 10 for correct, 2 for attempt
    xp_earned = 10 if is_correct else 2

    return {
        "is_correct": is_correct,
        "puzzle_rating": puzzle.rating,
        "rating_before": old_puzzle_rating,
        "rating_after": new_rating,
        "rating_change": change,
        "xp_earned": xp_earned,
    }


def get_mistakes(db: Session, user_id: str, limit: int = 10) -> dict:
    """Get recent incorrect puzzle attempts."""
    stmt = (
        select(PuzzleAttempt)
        .where(
            PuzzleAttempt.user_id == user_id,
            PuzzleAttempt.is_correct.is_(False),
        )
        .order_by(PuzzleAttempt.created_at.desc())
        .limit(limit)
    )
    attempts = db.execute(stmt).scalars().all()

    if not attempts:
        return {"mistakes": [], "total": 0}

    puzzle_ids = [a.puzzle_id for a in attempts]
    puzzles = db.execute(
        select(Puzzle).where(Puzzle.id.in_(puzzle_ids))
    ).scalars().all()
    puzzle_map = {p.id: p for p in puzzles}

    # Count total attempts per puzzle for the user to determine retried status
    attempt_counts_stmt = (
        select(
            PuzzleAttempt.puzzle_id,
            func.count().label("cnt"),
        )
        .where(
            PuzzleAttempt.user_id == user_id,
            PuzzleAttempt.puzzle_id.in_(puzzle_ids),
        )
        .group_by(PuzzleAttempt.puzzle_id)
    )
    attempt_counts = {
        row.puzzle_id: row.cnt
        for row in db.execute(attempt_counts_stmt).all()
    }

    mistakes = []
    for a in attempts:
        puzzle = puzzle_map.get(a.puzzle_id)
        if puzzle is None:
            continue
        mistakes.append({
            "attempt_id": a.id,
            "puzzle": _puzzle_to_dict(puzzle),
            "user_moves": a.user_moves or "",
            "attempted_at": a.created_at,
            "retried": attempt_counts.get(a.puzzle_id, 1) > 1,
        })

    # Total count
    total_stmt = select(func.count()).select_from(PuzzleAttempt).where(
        PuzzleAttempt.user_id == user_id,
        PuzzleAttempt.is_correct.is_(False),
    )
    total = db.execute(total_stmt).scalar() or 0

    return {"mistakes": mistakes, "total": total}


def get_puzzle_stats(db: Session, user_id: str) -> dict:
    """Get puzzle statistics for a user."""
    # Puzzle rating
    user_rating = db.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    ).scalar_one_or_none()
    puzzle_rating = user_rating.puzzle_rating if user_rating else 300

    # Total attempted and correct
    total_stmt = select(func.count()).select_from(PuzzleAttempt).where(
        PuzzleAttempt.user_id == user_id
    )
    total_attempted = db.execute(total_stmt).scalar() or 0

    correct_stmt = select(func.count()).select_from(PuzzleAttempt).where(
        PuzzleAttempt.user_id == user_id,
        PuzzleAttempt.is_correct.is_(True),
    )
    total_correct = db.execute(correct_stmt).scalar() or 0

    accuracy = round(total_correct / total_attempted * 100, 1) if total_attempted > 0 else 0.0

    # Today's daily attempts
    today = date.today()
    daily_stmt = select(func.count()).select_from(PuzzleAttempt).where(
        PuzzleAttempt.user_id == user_id,
        PuzzleAttempt.source == "daily",
        cast(PuzzleAttempt.created_at, Date) == today,
    )
    daily_today = db.execute(daily_stmt).scalar() or 0

    challenge_progress = get_challenge_progress(db, user_id)

    # Calculate puzzle streak: consecutive days with at least one correct attempt
    streak = _calculate_puzzle_streak(db, user_id)

    return {
        "puzzle_rating": puzzle_rating,
        "total_attempted": total_attempted,
        "total_correct": total_correct,
        "accuracy_pct": accuracy,
        "daily_attempted_today": daily_today,
        "streak": streak,
        "challenge_progress": challenge_progress,
    }


def _calculate_puzzle_streak(db: Session, user_id: str) -> int:
    """Calculate the number of consecutive days the user solved at least one puzzle correctly."""
    # Get distinct dates with correct attempts, ordered descending
    stmt = (
        select(cast(PuzzleAttempt.created_at, Date).label("attempt_date"))
        .where(
            PuzzleAttempt.user_id == user_id,
            PuzzleAttempt.is_correct.is_(True),
        )
        .group_by(cast(PuzzleAttempt.created_at, Date))
        .order_by(cast(PuzzleAttempt.created_at, Date).desc())
        .limit(365)
    )
    rows = db.execute(stmt).all()
    if not rows:
        return 0

    from datetime import timedelta

    streak = 0
    expected = date.today()
    for row in rows:
        attempt_date = row[0]
        # Handle string or date type from SQLite/Postgres
        if isinstance(attempt_date, str):
            attempt_date = date.fromisoformat(attempt_date)
        if attempt_date == expected:
            streak += 1
            expected -= timedelta(days=1)
        elif attempt_date == expected - timedelta(days=1) and streak == 0:
            # Allow starting from yesterday if no attempt yet today
            streak = 1
            expected = attempt_date - timedelta(days=1)
        else:
            break

    return streak


def _puzzle_to_dict(puzzle: Puzzle) -> dict:
    """Convert a Puzzle ORM object to dict."""
    return {
        "id": puzzle.id,
        "puzzle_code": puzzle.puzzle_code,
        "fen": puzzle.fen,
        "solution_moves": puzzle.solution_moves,
        "difficulty_level": puzzle.difficulty_level,
        "rating": puzzle.rating,
        "themes": puzzle.themes,
        "description": puzzle.description,
        "hint_text": puzzle.hint_text,
        "explanation": puzzle.explanation,
        "side_to_move": puzzle.side_to_move,
        "move_count": puzzle.move_count,
    }
