"""Unit tests for adventure_service.complete_challenge with quiz scoring."""
import uuid

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models.achievement import Achievement, UserAchievement
from app.models.adventure import PromotionChallenge
from app.models.gamification import UserRating
from app.models.user import User
from app.services import adventure_service


@pytest.fixture(autouse=True)
def clear_quiz_cache():
    adventure_service._QUIZ_BANK_CACHE.clear()
    yield
    adventure_service._QUIZ_BANK_CACHE.clear()


@pytest.fixture
def db() -> Session:
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, expire_on_commit=False)
    s = TestSession()
    try:
        yield s
    finally:
        s.close()
        engine.dispose()


@pytest.fixture
def user_id(db: Session) -> str:
    uid = str(uuid.uuid4())
    db.add(User(
        id=uid, username=f"u_{uid[:8]}", nickname=f"n_{uid[:8]}",
        password_hash="x", role="student", status="active",
    ))
    db.add(UserRating(
        id=str(uuid.uuid4()),
        user_id=uid,
        game_rating=400, puzzle_rating=400, xp_total=0, coins=0,
    ))
    db.commit()
    return uid


@pytest.fixture
def pending_record(db: Session, user_id: str) -> PromotionChallenge:
    rec = PromotionChallenge(
        id=str(uuid.uuid4()),
        user_id=user_id,
        challenge_type="meadow_exam",
        target_rank="meadow",
        status="pending",
        attempt_count=1,
    )
    db.add(rec)
    db.commit()
    return rec


@pytest.fixture
def achievement(db: Session) -> Achievement:
    a = Achievement(
        id=str(uuid.uuid4()),
        slug="meadow_exam_passed",
        name="启蒙草原毕业",
        description="通过「草原小考」",
        icon_key="🌿",
        category="adventure",
        condition_type="meadow_exam_pass",
        condition_value=1,
        xp_reward=0,
        coin_reward=50,
    )
    db.add(a)
    db.commit()
    return a


def test_all_correct_passes_and_grants_rewards(db, user_id, pending_record, achievement):
    answers = {"q1": "A", "q2": "D", "q3": "C", "q4": "B", "q5": "A"}
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="pass", quiz_answers=answers,
    )
    assert record is not None
    assert record.quiz_score == 5
    assert record.status == "passed"
    assert record.passed_at is not None

    ua = db.execute(select(UserAchievement).where(
        UserAchievement.user_id == user_id
    )).scalar_one_or_none()
    assert ua is not None

    ur = db.execute(select(UserRating).where(
        UserRating.user_id == user_id
    )).scalar_one_or_none()
    assert ur.coins == 50
    assert ur.xp_total >= 100


def test_three_correct_passes(db, user_id, pending_record, achievement):
    # q1=A ✓ q2=D ✓ q3=C ✓ q4=A ✗ q5=B ✗ → 3/5 just passing
    answers = {"q1": "A", "q2": "D", "q3": "C", "q4": "A", "q5": "B"}
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="pass", quiz_answers=answers,
    )
    assert record.quiz_score == 3
    assert record.status == "passed"


def test_two_correct_does_not_pass(db, user_id, pending_record, achievement):
    # q1=A ✓ q2=A ✗ q3=A ✗ q4=A ✗ q5=A ✓ → 2/5
    answers = {"q1": "A", "q2": "A", "q3": "A", "q4": "A", "q5": "A"}
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="fail", quiz_answers=answers,
    )
    assert record.quiz_score == 2
    assert record.status == "failed"
    assert record.passed_at is None

    ua = db.execute(select(UserAchievement)).scalar_one_or_none()
    assert ua is None


def test_missing_answers_counted_as_wrong(db, user_id, pending_record, achievement):
    # Only q1 + q3 answered, both correct → score=2, fail
    answers = {"q1": "A", "q3": "C"}
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="fail", quiz_answers=answers,
    )
    assert record.quiz_score == 2
    assert record.status == "failed"


def test_server_score_ignores_client_quiz_score(db, user_id, pending_record, achievement):
    # Client claims 5 but actually 2 correct → server says 2
    answers = {"q1": "A", "q2": "A", "q3": "A", "q4": "A", "q5": "A"}
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="pass", quiz_answers=answers, quiz_score=5,
    )
    assert record.quiz_score == 2  # server's count, not client's 5
    assert record.status == "failed"


def test_already_passed_is_idempotent(db, user_id, achievement):
    # Seed a passed record
    from datetime import datetime, timezone
    prior_time = datetime(2026, 4, 1, tzinfo=timezone.utc)
    rec = PromotionChallenge(
        id=str(uuid.uuid4()),
        user_id=user_id,
        challenge_type="meadow_exam",
        target_rank="meadow",
        status="passed",
        attempt_count=1,
        quiz_score=4,
        passed_at=prior_time,
    )
    db.add(rec)
    db.add(UserAchievement(
        id=str(uuid.uuid4()),
        user_id=user_id,
        achievement_id=achievement.id,
    ))
    db.commit()

    # complete_challenge finds no "pending" record → returns None
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="pass", quiz_answers={"q1": "A", "q2": "D", "q3": "C", "q4": "B", "q5": "A"},
    )
    assert record is None  # no pending to update

    # passed_at unchanged
    reloaded = db.execute(select(PromotionChallenge).where(
        PromotionChallenge.user_id == user_id
    )).scalar_one_or_none()
    assert reloaded.passed_at == prior_time


def test_quiz_bank_missing_does_not_crash(db, user_id, pending_record, monkeypatch):
    # Simulate missing quiz bank
    monkeypatch.setattr(adventure_service, "_load_quiz", lambda cid: None)
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="pass", quiz_answers={"q1": "A"},
    )
    # Without bank, server falls back to client result → status = passed (from result='pass')
    assert record is not None


def test_reward_failure_does_not_abort(db, user_id, pending_record, achievement, monkeypatch):
    from app.services import gamification_service
    def boom(*args, **kwargs):
        raise RuntimeError("xp service down")
    monkeypatch.setattr(gamification_service, "award_xp", boom)

    answers = {"q1": "A", "q2": "D", "q3": "C", "q4": "B", "q5": "A"}
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="pass", quiz_answers=answers,
    )
    assert record.quiz_score == 5
    assert record.status == "passed"
