"""Adventure service layer (B3-3, B3-4)."""

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.models.adventure import PromotionChallenge
from app.models.gamification import UserRating
from app.schemas.adventure import (
    AdventureMapResponse,
    ChallengeItem,
    ChallengeRecord,
    RegionDetail,
    RegionItem,
)

# ── Hard-coded region data ───────────────────────────────────────

REGIONS = [
    {
        "id": "meadow",
        "name": "启蒙草原",
        "description": "一片宁静的草原，适合初学者冒险",
        "rating_range": [0, 800],
        "challenges": [
            {
                "id": "meadow_exam",
                "name": "草原小考",
                "type": "quiz",
                "description": "回答5个棋类基础问题",
                "reward_xp": 100,
            },
            {
                "id": "meadow_guardian",
                "name": "草原守护者之战",
                "type": "battle",
                "description": "击败草原守护者龟龟",
                "reward_xp": 200,
                "opponent_id": "guigui",
            },
        ],
        "icon": "🌿",
        "unlock_condition": {"type": "free"},
    },
    {
        "id": "forest",
        "name": "试炼森林",
        "description": "密林深处有更强的对手等待...",
        "rating_range": [800, 1200],
        "challenges": [],
        "icon": "🌲",
        "unlock_condition": {"type": "rating", "value": 800},
    },
    {
        "id": "highland",
        "name": "风暴高原",
        "description": "高原上风云变幻...",
        "rating_range": [1200, 1600],
        "challenges": [],
        "icon": "⛰️",
        "unlock_condition": {"type": "rating", "value": 1200},
    },
    {
        "id": "abyss",
        "name": "暗影深渊",
        "description": "最终的考验在此等待...",
        "rating_range": [1600, 2400],
        "challenges": [],
        "icon": "🌑",
        "unlock_condition": {"type": "rating", "value": 1600},
    },
]


# ── Quiz bank (lazy-loaded from content/quizzes/<id>.json) ──────

_QUIZ_BANK_CACHE: dict[str, dict] = {}


def _load_quiz(challenge_id: str) -> Optional[dict]:
    """Lazy-load quiz bank JSON into process-level cache."""
    if challenge_id in _QUIZ_BANK_CACHE:
        return _QUIZ_BANK_CACHE[challenge_id]
    # content/quizzes/<id>.json, relative to project root
    path = Path(__file__).resolve().parents[3] / "content" / "quizzes" / f"{challenge_id}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        _QUIZ_BANK_CACHE[challenge_id] = data
        return data
    except Exception:
        return None


def get_quiz_bank(challenge_id: str) -> Optional[dict]:
    """Get the full quiz bank (including answers + explanations) for a
    challenge. Returns None if not found. Callers (router) are
    responsible for mapping to QuizBankResponse schema.
    """
    return _load_quiz(challenge_id)


def _get_region_by_id(region_id: str) -> Optional[dict]:
    """Look up a region dict by ID."""
    for r in REGIONS:
        if r["id"] == region_id:
            return r
    return None


def _is_region_unlocked(region: dict, user_rating: int) -> bool:
    """Check if a region is unlocked for the user."""
    cond = region["unlock_condition"]
    if cond["type"] == "free":
        return True
    if cond["type"] == "rating":
        return user_rating >= cond["value"]
    return False


def _current_region_for_rating(rating: int) -> str:
    """Determine which region the user belongs to based on rating."""
    for r in reversed(REGIONS):
        if rating >= r["rating_range"][0]:
            return r["id"]
    return "meadow"


def get_adventure_map(db: Session, user_id: str) -> AdventureMapResponse:
    """Get the adventure map with all regions and user's progress.

    Args:
        db: Database session.
        user_id: Current user ID.

    Returns:
        AdventureMapResponse with regions and current status.
    """
    # Get user rating
    rating_stmt = select(UserRating).where(UserRating.user_id == user_id)
    user_rating_row = db.execute(rating_stmt).scalar_one_or_none()
    current_rating = user_rating_row.game_rating if user_rating_row else 300

    # Get user's completed challenges
    challenge_stmt = select(PromotionChallenge).where(
        PromotionChallenge.user_id == user_id,
        PromotionChallenge.status == "passed",
    )
    completed_challenges = db.execute(challenge_stmt).scalars().all()
    completed_ids = {c.challenge_type for c in completed_challenges}

    regions = []
    for r in REGIONS:
        unlocked = _is_region_unlocked(r, current_rating)
        challenges_total = len(r["challenges"])
        challenges_completed = sum(
            1 for ch in r["challenges"] if ch["id"] in completed_ids
        )
        regions.append(
            RegionItem(
                id=r["id"],
                name=r["name"],
                description=r["description"],
                rating_range=r["rating_range"],
                icon=r["icon"],
                unlock_condition=r["unlock_condition"],
                is_unlocked=unlocked,
                challenges_total=challenges_total,
                challenges_completed=challenges_completed,
            )
        )

    return AdventureMapResponse(
        regions=regions,
        current_rating=current_rating,
        current_region=_current_region_for_rating(current_rating),
    )


def get_region_detail(db: Session, region_id: str, user_id: str) -> Optional[RegionDetail]:
    """Get region detail with challenges and user completion status.

    Args:
        db: Database session.
        region_id: Region ID.
        user_id: Current user ID.

    Returns:
        RegionDetail or None if region not found.
    """
    region = _get_region_by_id(region_id)
    if region is None:
        return None

    # Get user rating for unlock check
    rating_stmt = select(UserRating).where(UserRating.user_id == user_id)
    user_rating_row = db.execute(rating_stmt).scalar_one_or_none()
    current_rating = user_rating_row.game_rating if user_rating_row else 300
    unlocked = _is_region_unlocked(region, current_rating)

    # Get completed challenge IDs
    challenge_stmt = select(PromotionChallenge).where(
        PromotionChallenge.user_id == user_id,
        PromotionChallenge.status == "passed",
    )
    completed = db.execute(challenge_stmt).scalars().all()
    completed_ids = {c.challenge_type for c in completed}

    challenges = []
    for ch in region["challenges"]:
        challenges.append(
            ChallengeItem(
                id=ch["id"],
                name=ch["name"],
                type=ch["type"],
                description=ch["description"],
                reward_xp=ch["reward_xp"],
                opponent_id=ch.get("opponent_id"),
                is_completed=ch["id"] in completed_ids,
            )
        )

    return RegionDetail(
        id=region["id"],
        name=region["name"],
        description=region["description"],
        rating_range=region["rating_range"],
        icon=region["icon"],
        unlock_condition=region["unlock_condition"],
        is_unlocked=unlocked,
        challenges=challenges,
    )


def start_challenge(db: Session, user_id: str, challenge_id: str) -> Optional[ChallengeRecord]:
    """Start a promotion challenge.

    Creates a new PromotionChallenge record or returns existing pending one.

    Args:
        db: Database session.
        user_id: Current user ID.
        challenge_id: Challenge ID (e.g. meadow_exam).

    Returns:
        ChallengeRecord or None if challenge not found.
    """
    # Look up challenge in regions data
    challenge_data = None
    region_id = None
    for r in REGIONS:
        for ch in r["challenges"]:
            if ch["id"] == challenge_id:
                challenge_data = ch
                region_id = r["id"]
                break
        if challenge_data:
            break

    if challenge_data is None:
        return None

    # Check if there's already a pending challenge
    existing_stmt = select(PromotionChallenge).where(
        PromotionChallenge.user_id == user_id,
        PromotionChallenge.challenge_type == challenge_id,
        PromotionChallenge.status == "pending",
    )
    existing = db.execute(existing_stmt).scalar_one_or_none()
    if existing:
        return ChallengeRecord(
            id=existing.id,
            user_id=existing.user_id,
            challenge_id=existing.challenge_type,
            challenge_type=challenge_data["type"],
            target_rank=region_id,
            status=existing.status,
            game_id=existing.game_id,
            quiz_score=existing.quiz_score,
            attempt_count=existing.attempt_count,
            passed_at=existing.passed_at,
            created_at=existing.created_at,
        )

    # Count previous attempts
    count_stmt = select(PromotionChallenge).where(
        PromotionChallenge.user_id == user_id,
        PromotionChallenge.challenge_type == challenge_id,
    )
    previous = db.execute(count_stmt).scalars().all()
    attempt_count = len(previous) + 1

    record = PromotionChallenge(
        id=str(uuid.uuid4()),
        user_id=user_id,
        challenge_type=challenge_id,
        target_rank=region_id,
        status="pending",
        attempt_count=attempt_count,
    )
    db.add(record)
    db.flush()

    return ChallengeRecord(
        id=record.id,
        user_id=record.user_id,
        challenge_id=record.challenge_type,
        challenge_type=challenge_data["type"],
        target_rank=record.target_rank,
        status=record.status,
        game_id=record.game_id,
        quiz_score=record.quiz_score,
        attempt_count=record.attempt_count,
        passed_at=record.passed_at,
        created_at=record.created_at,
    )


def complete_challenge(
    db: Session,
    user_id: str,
    challenge_id: str,
    result: str,
    game_id: Optional[str] = None,
    quiz_answers: Optional[dict] = None,
    quiz_score: Optional[int] = None,  # accepted for backward compat, ignored if bank exists
) -> Optional[ChallengeRecord]:
    """Complete a promotion challenge.

    For quiz-type challenges with quiz_answers: the server independently
    computes quiz_score from the loaded bank and overrides the client's
    result/quiz_score. Rewards (XP + achievement) fire on first pass.
    """
    stmt = select(PromotionChallenge).where(
        PromotionChallenge.user_id == user_id,
        PromotionChallenge.challenge_type == challenge_id,
        PromotionChallenge.status == "pending",
    )
    record = db.execute(stmt).scalar_one_or_none()
    if record is None:
        return None

    challenge_data = None
    for r in REGIONS:
        for ch in r["challenges"]:
            if ch["id"] == challenge_id:
                challenge_data = ch
                break
        if challenge_data:
            break

    # ── Quiz branch: server-side scoring ─────────────────────
    bank = _load_quiz(challenge_id) if quiz_answers else None
    if bank and quiz_answers is not None:
        score = sum(
            1 for q in bank["questions"]
            if quiz_answers.get(q["id"]) == q["answer"]
        )
        record.quiz_answers = quiz_answers
        record.quiz_score = score

        if score >= bank["pass_threshold"]:
            record.status = "passed"
            record.passed_at = datetime.now(timezone.utc)
            try:
                from app.services.gamification_service import award_xp
                award_xp(db, user_id, bank["reward_xp"], reason="meadow_exam_passed")
            except Exception as e:
                logger.warning("award_xp failed for user %s: %s", user_id, e)
            try:
                from app.services.gamification_service import grant_achievement_by_slug
                grant_achievement_by_slug(
                    db, user_id, bank["passed_achievement_slug"]
                )
            except Exception as e:
                logger.warning("grant_achievement failed for user %s: %s", user_id, e)
        else:
            record.status = "failed"
    else:
        # ── Non-quiz (battle) branch or quiz with no bank: trust client ──
        if result == "pass":
            record.status = "passed"
            record.passed_at = datetime.now(timezone.utc)
            if challenge_data:
                _award_challenge_xp(db, user_id, challenge_data["reward_xp"])
        else:
            record.status = "failed"

        if quiz_answers:
            record.quiz_answers = quiz_answers
        if quiz_score is not None:
            record.quiz_score = quiz_score

    if game_id:
        record.game_id = game_id

    db.add(record)
    db.flush()

    return ChallengeRecord(
        id=record.id,
        user_id=record.user_id,
        challenge_id=record.challenge_type,
        challenge_type=challenge_data["type"] if challenge_data else record.challenge_type,
        target_rank=record.target_rank,
        status=record.status,
        game_id=record.game_id,
        quiz_score=record.quiz_score,
        attempt_count=record.attempt_count,
        passed_at=record.passed_at,
        created_at=record.created_at,
    )


def _award_challenge_xp(db: Session, user_id: str, xp: int) -> None:
    """Award XP to the user for completing a challenge."""
    rating_stmt = select(UserRating).where(UserRating.user_id == user_id)
    user_rating = db.execute(rating_stmt).scalar_one_or_none()
    if user_rating:
        user_rating.xp_total = (user_rating.xp_total or 0) + xp
        user_rating.xp_today = (user_rating.xp_today or 0) + xp
        db.add(user_rating)
