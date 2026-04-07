"""Synchronous SQLAlchemy 2.0 database setup (SQLite / PostgreSQL)."""

import logging

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

logger = logging.getLogger("chess_edu.database")

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# Build engine kwargs based on backend
_engine_kwargs: dict = {"echo": settings.APP_DEBUG}

if _is_sqlite:
    # SQLite: no pool configuration needed (single-file)
    pass
else:
    # PostgreSQL: connection pool settings
    _engine_kwargs.update(
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )

# Create synchronous engine
engine = create_engine(settings.DATABASE_URL, **_engine_kwargs)

# Enable WAL mode for better concurrent read performance (SQLite only)
if _is_sqlite:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

# Session factory
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


def get_db():
    """Dependency that yields a synchronous database session."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """Create all tables and run lightweight migrations (SQLite only)."""
    Base.metadata.create_all(bind=engine)
    if _is_sqlite:
        _run_migrations()
    else:
        logger.info("PostgreSQL detected — skipping SQLite _run_migrations().")


def _run_migrations():
    """Add missing columns to existing tables (SQLite compatible).

    For PostgreSQL, schema migrations should be handled by Alembic.
    """
    inspector = inspect(engine)
    migrations = [
        # (table, column, sql)
        ("daily_puzzles", "user_id", "ALTER TABLE daily_puzzles ADD COLUMN user_id VARCHAR(36)"),
        ("users", "phone", "ALTER TABLE users ADD COLUMN phone VARCHAR(20)"),
    ]
    with engine.begin() as conn:
        for table, column, sql in migrations:
            if not inspector.has_table(table):
                continue
            existing = [c["name"] for c in inspector.get_columns(table)]
            if column not in existing:
                conn.execute(text(sql))
                logger.info("Migration: added %s.%s", table, column)
