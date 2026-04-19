"""Unit tests for streak_service.touch_activity."""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models.gamification import UserStreak
from app.models.user import User
from app.services import streak_service


@pytest.fixture(autouse=True)
def clear_cache():
    """Reset the module-level cache before each test."""
    streak_service._touch_cache.clear()
    yield
    streak_service._touch_cache.clear()


@pytest.fixture
def db() -> Session:
    """Fresh in-memory SQLite DB per test, with all tables created."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, expire_on_commit=False)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def user_id(db: Session) -> str:
    """Seed a user row so UserStreak.user_id FK passes."""
    uid = str(uuid.uuid4())
    user = User(
        id=uid,
        username=f"test_{uid[:8]}",
        password_hash="x",
        nickname=f"test_{uid[:8]}",
        role="student",
        status="active",
    )
    db.add(user)
    db.commit()
    return uid


def _get_streak(db: Session, uid: str) -> UserStreak | None:
    from sqlalchemy import select
    return db.execute(
        select(UserStreak).where(UserStreak.user_id == uid)
    ).scalar_one_or_none()


def test_first_call_creates_streak_and_populates_cache(db, user_id):
    assert _get_streak(db, user_id) is None

    streak_service.touch_activity(db, user_id)

    s = _get_streak(db, user_id)
    assert s is not None
    assert s.login_streak == 1
    assert s.login_streak_max == 1
    assert s.last_login_date == date.today()
    assert streak_service._touch_cache[user_id] == date.today()


def test_same_day_second_call_uses_cache(db, user_id):
    streak_service.touch_activity(db, user_id)

    # Spy on db.execute after the first call
    original_execute = db.execute
    db.execute = MagicMock(side_effect=original_execute)

    streak_service.touch_activity(db, user_id)

    db.execute.assert_not_called()  # cache short-circuit


def test_consecutive_day_increments_streak(db, user_id):
    yesterday = date.today() - timedelta(days=1)
    db.add(UserStreak(
        id=str(uuid.uuid4()),
        user_id=user_id,
        login_streak=3,
        login_streak_max=5,
        last_login_date=yesterday,
    ))
    db.commit()

    streak_service.touch_activity(db, user_id)

    s = _get_streak(db, user_id)
    assert s.login_streak == 4
    assert s.login_streak_max == 5  # not beaten
    assert s.last_login_date == date.today()


def test_consecutive_day_updates_max(db, user_id):
    yesterday = date.today() - timedelta(days=1)
    db.add(UserStreak(
        id=str(uuid.uuid4()),
        user_id=user_id,
        login_streak=5,
        login_streak_max=5,
        last_login_date=yesterday,
    ))
    db.commit()

    streak_service.touch_activity(db, user_id)

    s = _get_streak(db, user_id)
    assert s.login_streak == 6
    assert s.login_streak_max == 6  # new record


def test_gap_of_two_days_resets_streak(db, user_id):
    two_days_ago = date.today() - timedelta(days=2)
    db.add(UserStreak(
        id=str(uuid.uuid4()),
        user_id=user_id,
        login_streak=10,
        login_streak_max=10,
        last_login_date=two_days_ago,
    ))
    db.commit()

    streak_service.touch_activity(db, user_id)

    s = _get_streak(db, user_id)
    assert s.login_streak == 1
    assert s.login_streak_max == 10  # preserved
    assert s.last_login_date == date.today()


def test_same_day_in_db_but_cache_empty_is_noop(db, user_id):
    """Cache cleared (e.g. after restart) but DB already has today."""
    db.add(UserStreak(
        id=str(uuid.uuid4()),
        user_id=user_id,
        login_streak=7,
        login_streak_max=7,
        last_login_date=date.today(),
    ))
    db.commit()

    streak_service.touch_activity(db, user_id)

    s = _get_streak(db, user_id)
    assert s.login_streak == 7  # unchanged
    assert streak_service._touch_cache[user_id] == date.today()  # filled


def test_db_error_is_swallowed_and_cache_not_updated(db, user_id, caplog):
    """SELECT raises -> touch_activity does not raise, cache stays empty."""
    import logging
    caplog.set_level(logging.WARNING)
    db.execute = MagicMock(side_effect=RuntimeError("db down"))

    streak_service.touch_activity(db, user_id)  # must not raise

    assert user_id not in streak_service._touch_cache
    assert any("touch_activity failed" in rec.message for rec in caplog.records)


def test_empty_user_id_is_noop(db):
    """Defensive: None or empty user_id should no-op without DB access."""
    db.execute = MagicMock()

    streak_service.touch_activity(db, None)
    streak_service.touch_activity(db, "")

    db.execute.assert_not_called()
