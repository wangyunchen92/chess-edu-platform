"""Unit tests for gamification_service.grant_achievement_by_slug."""
import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models.achievement import Achievement, UserAchievement
from app.models.gamification import UserRating
from app.models.user import User
from app.services import gamification_service


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
        game_rating=400, puzzle_rating=400, xp_total=0, coins=10,
    ))
    db.commit()
    return uid


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


def test_grant_new_achievement_adds_row_and_coins(db, user_id, achievement):
    granted = gamification_service.grant_achievement_by_slug(
        db, user_id, "meadow_exam_passed"
    )
    assert granted is True

    ua = db.execute(
        select(UserAchievement).where(UserAchievement.user_id == user_id)
    ).scalar_one_or_none()
    assert ua is not None
    assert ua.achievement_id == achievement.id

    ur = db.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    ).scalar_one_or_none()
    assert ur.coins == 60  # 10 + 50


def test_grant_is_idempotent(db, user_id, achievement):
    gamification_service.grant_achievement_by_slug(db, user_id, "meadow_exam_passed")
    granted_second = gamification_service.grant_achievement_by_slug(
        db, user_id, "meadow_exam_passed"
    )
    assert granted_second is False

    ur = db.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    ).scalar_one_or_none()
    assert ur.coins == 60  # not doubled


def test_grant_unknown_slug_returns_false(db, user_id):
    granted = gamification_service.grant_achievement_by_slug(
        db, user_id, "nonexistent_slug"
    )
    assert granted is False
