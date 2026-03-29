"""Puzzle service layer (B2-1 & B2-2)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.gamification import RatingHistory, UserRating
from app.models.puzzle import DailyPuzzle, Puzzle, PuzzleAttempt
from app.utils.elo import calculate_puzzle_rating


def get_daily_puzzles(db: Session, user_id: str) -> dict:
    """Get or generate today's 3 daily puzzles with user attempt status."""
    today = date.today()

    # Check if daily puzzles exist for today
    stmt = (
        select(DailyPuzzle)
        .where(DailyPuzzle.puzzle_date == today)
        .order_by(DailyPuzzle.sort_order)
    )
    daily_records = db.execute(stmt).scalars().all()

    if not daily_records:
        # Generate today's puzzles from the daily pool
        pool_stmt = (
            select(Puzzle)
            .where(Puzzle.is_daily_pool.is_(True))
            .order_by(func.random())
            .limit(3)
        )
        pool_puzzles = db.execute(pool_stmt).scalars().all()

        # If not enough daily pool puzzles, grab from challenge pool
        if len(pool_puzzles) < 3:
            extra_stmt = (
                select(Puzzle)
                .where(
                    Puzzle.is_daily_pool.is_(False),
                    Puzzle.id.notin_([p.id for p in pool_puzzles]),
                )
                .order_by(func.random())
                .limit(3 - len(pool_puzzles))
            )
            pool_puzzles.extend(db.execute(extra_stmt).scalars().all())

        new_records = []
        for i, puzzle in enumerate(pool_puzzles):
            dp = DailyPuzzle(
                id=str(uuid.uuid4()),
                puzzle_date=today,
                puzzle_id=puzzle.id,
                sort_order=i + 1,
            )
            db.add(dp)
            new_records.append(dp)
        db.flush()

        # Use the just-created records directly instead of re-querying
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


def get_challenge_progress(db: Session, user_id: str) -> list[dict]:
    """Get challenge progress across difficulty levels 1-5."""
    levels = []
    for level in range(1, 6):
        total_stmt = select(func.count()).select_from(Puzzle).where(
            Puzzle.is_challenge.is_(True),
            Puzzle.difficulty_level == level,
        )
        total = db.execute(total_stmt).scalar() or 0

        solved_stmt = (
            select(func.count(func.distinct(PuzzleAttempt.puzzle_id)))
            .select_from(PuzzleAttempt)
            .join(Puzzle, Puzzle.id == PuzzleAttempt.puzzle_id)
            .where(
                PuzzleAttempt.user_id == user_id,
                PuzzleAttempt.is_correct.is_(True),
                PuzzleAttempt.source == "challenge",
                Puzzle.difficulty_level == level,
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
    """Get puzzles for a specific challenge level with attempt status."""
    stmt = (
        select(Puzzle)
        .where(
            Puzzle.is_challenge.is_(True),
            Puzzle.difficulty_level == level,
        )
        .order_by(Puzzle.challenge_order, Puzzle.id)
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
        func.date(PuzzleAttempt.created_at) == today,
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
        select(func.date(PuzzleAttempt.created_at).label("attempt_date"))
        .where(
            PuzzleAttempt.user_id == user_id,
            PuzzleAttempt.is_correct.is_(True),
        )
        .group_by(func.date(PuzzleAttempt.created_at))
        .order_by(func.date(PuzzleAttempt.created_at).desc())
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
