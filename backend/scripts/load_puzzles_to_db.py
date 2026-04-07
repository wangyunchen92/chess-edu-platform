"""
Import lichess_16k.json puzzles into the database.

Usage:
    python3 scripts/load_puzzles_to_db.py

Reads content/puzzles/lichess_16k.json and inserts into puzzles table.
Skips puzzles that already exist (by puzzle_code).
"""

import json
import os
import sys
import uuid

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal, engine
from app.models.puzzle import Puzzle


def main():
    # Ensure tables exist
    from app.database import init_db
    init_db()

    json_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "content", "puzzles", "lichess_16k.json"
    )
    json_path = os.path.abspath(json_path)

    print(f"Reading {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    puzzles = data["puzzles"]
    print(f"Loaded {len(puzzles)} puzzles from JSON")

    db = SessionLocal()
    try:
        # Get existing puzzle codes to skip duplicates
        existing = set()
        for row in db.query(Puzzle.puzzle_code).all():
            existing.add(row[0])
        print(f"Found {len(existing)} existing puzzles in DB")

        inserted = 0
        skipped = 0
        batch = []

        for p in puzzles:
            if p["puzzle_code"] in existing:
                skipped += 1
                continue

            puzzle = Puzzle(
                id=str(uuid.uuid4()),
                puzzle_code=p["puzzle_code"],
                fen=p["fen"],
                solution_moves=p["solution_moves"],
                difficulty_level=p["difficulty_level"],
                rating=p["rating"],
                themes=p.get("themes"),
                description=p.get("description"),
                hint_text=p.get("hint_text"),
                explanation=p.get("explanation"),
                side_to_move=p["side_to_move"],
                move_count=p["move_count"],
                source=p.get("source", "lichess"),
                is_daily_pool=p.get("is_daily_pool", True),
                is_challenge=p.get("is_challenge", True),
                challenge_order=None,
            )
            batch.append(puzzle)
            inserted += 1

            if len(batch) >= 500:
                db.add_all(batch)
                db.flush()
                batch = []
                print(f"  inserted {inserted}...")

        if batch:
            db.add_all(batch)
            db.flush()

        db.commit()
        print(f"\nDone: inserted {inserted}, skipped {skipped} duplicates")

        # Stats
        total = db.query(Puzzle).count()
        daily = db.query(Puzzle).filter(Puzzle.is_daily_pool.is_(True)).count()
        print(f"Total puzzles in DB: {total}")
        print(f"Daily pool: {daily}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
