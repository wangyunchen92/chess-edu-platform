"""Synchronous SQLAlchemy 2.0 database setup (SQLite)."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# Create synchronous engine
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.APP_DEBUG,
)

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
    """Create all tables."""
    Base.metadata.create_all(bind=engine)
