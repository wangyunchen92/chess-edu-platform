"""Seed the meadow_exam_passed achievement row.

Idempotent: safe to run multiple times.
"""
import os
import sys
import uuid

# Ensure we can import from backend/app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.database import SessionLocal
from app.models.achievement import Achievement


ACHIEVEMENT = {
    "slug": "meadow_exam_passed",
    "name": "启蒙草原毕业",
    "description": "通过「草原小考」",
    "icon_key": "🌿",
    "category": "adventure",
    "condition_type": "meadow_exam_pass",
    "condition_value": 1,
    "xp_reward": 0,
    "coin_reward": 50,
    "rarity": "common",
    "sort_order": 100,
}


def main() -> None:
    db = SessionLocal()
    try:
        existing = db.execute(
            select(Achievement).where(Achievement.slug == ACHIEVEMENT["slug"])
        ).scalar_one_or_none()
        if existing:
            print(f"[seed] already exists: {existing.slug}")
            return
        row = Achievement(id=str(uuid.uuid4()), **ACHIEVEMENT)
        db.add(row)
        db.commit()
        print(f"[seed] inserted achievement: {row.slug}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
