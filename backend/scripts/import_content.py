"""Import content data from JSON files into the database.

Reads characters, dialogues, puzzles, achievements, and course metadata
from the content/ directory and inserts them into their respective DB tables.
Designed to be called once on first startup (when tables are empty).
"""

import json
import logging
import os
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.achievement import Achievement
from app.models.character import Character, CharacterDialogue
from app.models.course import Course, Lesson
from app.models.puzzle import Puzzle

logger = logging.getLogger("chess_edu.import_content")

CONTENT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "..",
    "content",
)


def _table_has_rows(db: Session, model) -> bool:
    """Check if a table already has data."""
    return db.execute(select(model.id).limit(1)).first() is not None


def import_characters(db: Session) -> int:
    """Import characters and dialogues from content/characters/*.json."""
    if _table_has_rows(db, Character):
        logger.info("characters table already has data, skipping import.")
        return 0

    chars_dir = os.path.join(CONTENT_DIR, "characters")
    if not os.path.isdir(chars_dir):
        logger.warning("characters content directory not found: %s", chars_dir)
        return 0

    # Collect character JSON files (exclude dialogues)
    char_files = sorted(
        f for f in os.listdir(chars_dir)
        if f.endswith(".json") and "_dialogues" not in f
    )

    count = 0
    sort_order = 0
    for filename in char_files:
        filepath = os.path.join(chars_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        slug = data["id"]
        engine = data.get("engine_params", {})
        is_free = data.get("unlock_condition") == "default"

        char = Character(
            id=slug,
            slug=slug,
            name=data["name"],
            tier=data["tier"],
            avatar_key=data.get("avatar", f"/assets/characters/{slug}/avatar.png"),
            personality=data.get("personality", ""),
            play_style=data.get("play_style", "balanced"),
            base_rating=data.get("rating", 500),
            rating_range_min=max(data.get("rating", 500) - 200, 100),
            rating_range_max=data.get("rating", 500) + 200,
            engine_depth_min=engine.get("depth_min", 3),
            engine_depth_max=engine.get("depth_max", 5),
            mistake_rate=engine.get("error_rate", 0.3),
            unlock_condition={"type": data.get("unlock_condition", "default")},
            is_free=is_free,
            sort_order=sort_order,
        )
        db.add(char)
        sort_order += 1
        count += 1

        # Import dialogues if file exists
        dialogue_file = os.path.join(chars_dir, f"{slug}_dialogues.json")
        if os.path.exists(dialogue_file):
            with open(dialogue_file, "r", encoding="utf-8") as f:
                dlg_data = json.load(f)
            dialogues = dlg_data.get("dialogues", {})
            dlg_order = 0
            for scene, lines in dialogues.items():
                for line in lines:
                    dlg = CharacterDialogue(
                        id=str(uuid.uuid4()),
                        character_id=slug,
                        scene=scene,
                        content=line.get("text", ""),
                        emotion=line.get("expression", "normal"),
                        sort_order=dlg_order,
                    )
                    db.add(dlg)
                    dlg_order += 1

    db.flush()
    logger.info("Imported %d characters.", count)
    return count


def import_puzzles(db: Session) -> int:
    """Import puzzles from content/puzzles/."""
    if _table_has_rows(db, Puzzle):
        logger.info("puzzles table already has data, skipping import.")
        return 0

    puzzles_dir = os.path.join(CONTENT_DIR, "puzzles")
    if not os.path.isdir(puzzles_dir):
        logger.warning("puzzles content directory not found: %s", puzzles_dir)
        return 0

    count = 0

    # Import challenge puzzles (level_1.json, level_2.json, level_3.json)
    challenge_dir = os.path.join(puzzles_dir, "challenge")
    if os.path.isdir(challenge_dir):
        for filename in sorted(os.listdir(challenge_dir)):
            if not filename.endswith(".json"):
                continue
            filepath = os.path.join(challenge_dir, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)

            level = data.get("level", 1)
            for i, p in enumerate(data.get("puzzles", [])):
                solution_str = ",".join(p.get("solution", []))
                themes_str = ",".join(p.get("themes", []))
                fen = p["fen"]
                side = "white" if " w " in fen else "black"

                puzzle = Puzzle(
                    id=p["id"],
                    puzzle_code=p["id"],
                    fen=fen,
                    solution_moves=solution_str,
                    difficulty_level=level,
                    rating=p.get("difficulty_rating", 500),
                    themes=themes_str,
                    description=p.get("description", ""),
                    hint_text=None,
                    explanation=p.get("explanation", ""),
                    side_to_move=side,
                    move_count=len(p.get("solution", [])),
                    source="challenge",
                    is_daily_pool=False,
                    is_challenge=True,
                    challenge_order=i + 1,
                )
                db.add(puzzle)
                count += 1

    # Import daily pool puzzles
    daily_pool_file = os.path.join(puzzles_dir, "daily", "pool.json")
    if os.path.exists(daily_pool_file):
        with open(daily_pool_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        for i, p in enumerate(data.get("puzzles", [])):
            pid = p["id"]
            # Check for id collision with challenge puzzles
            existing = db.execute(select(Puzzle).where(Puzzle.id == pid)).first()
            if existing:
                continue

            solution_str = ",".join(p.get("solution", []))
            themes_str = ",".join(p.get("themes", []))
            fen = p["fen"]
            side = "white" if " w " in fen else "black"

            # Map difficulty string to level number
            diff_map = {"easy": 1, "medium": 2, "hard": 3}
            diff_level = diff_map.get(p.get("difficulty", "easy"), 1)

            puzzle = Puzzle(
                id=pid,
                puzzle_code=pid,
                fen=fen,
                solution_moves=solution_str,
                difficulty_level=diff_level,
                rating=p.get("difficulty_rating", 500),
                themes=themes_str,
                description=p.get("description", ""),
                hint_text=None,
                explanation=p.get("explanation", ""),
                side_to_move=side,
                move_count=len(p.get("solution", [])),
                source="daily_pool",
                is_daily_pool=True,
                is_challenge=False,
                challenge_order=None,
            )
            db.add(puzzle)
            count += 1

    db.flush()
    logger.info("Imported %d puzzles.", count)
    return count


def import_achievements(db: Session) -> int:
    """Import achievements from content/achievements/achievements.json."""
    if _table_has_rows(db, Achievement):
        logger.info("achievements table already has data, skipping import.")
        return 0

    ach_file = os.path.join(CONTENT_DIR, "achievements", "achievements.json")
    if not os.path.exists(ach_file):
        logger.warning("achievements file not found: %s", ach_file)
        return 0

    with open(ach_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    count = 0
    for i, a in enumerate(data.get("achievements", [])):
        condition = a.get("condition", {})
        reward = a.get("reward", {})

        ach = Achievement(
            id=str(uuid.uuid4()),
            slug=a["slug"],
            name=a["name"],
            description=a.get("description", ""),
            icon_key=a.get("icon", ""),
            category=a.get("category", "milestone"),
            condition_type=condition.get("type", "unknown"),
            condition_value=condition.get("threshold", 1),
            xp_reward=reward.get("amount", 50) if reward.get("type") == "xp" else 50,
            coin_reward=reward.get("amount", 100) if reward.get("type") == "coin" else 100,
            rarity="common",
            sort_order=i,
        )
        db.add(ach)
        count += 1

    db.flush()
    logger.info("Imported %d achievements.", count)
    return count


def import_courses(db: Session) -> int:
    """Import course and lesson metadata from content/courses/*/meta.json.

    Only imports metadata (id, title, order, etc.) into courses and lessons tables.
    Actual lesson content (steps, exercises) is read directly from JSON files at runtime.
    """
    if _table_has_rows(db, Course):
        logger.info("courses table already has data, skipping import.")
        return 0

    courses_dir = os.path.join(CONTENT_DIR, "courses")
    if not os.path.isdir(courses_dir):
        logger.warning("courses content directory not found: %s", courses_dir)
        return 0

    count = 0
    for dirname in sorted(os.listdir(courses_dir)):
        meta_file = os.path.join(courses_dir, dirname, "meta.json")
        if not os.path.exists(meta_file):
            continue

        with open(meta_file, "r", encoding="utf-8") as f:
            meta = json.load(f)

        course_id = meta["id"]
        course = Course(
            id=course_id,
            slug=course_id,
            title=meta["title"],
            description=meta.get("description", ""),
            level=meta.get("level", 0),
            total_lessons=meta.get("total_lessons", 0),
            is_free=(meta.get("level", 0) == 0),
            membership_required=None,
            sort_order=meta.get("level", 0),
        )
        db.add(course)
        count += 1

        # Import lesson metadata from meta.json "lessons" array, or from individual lesson files
        lessons_meta = meta.get("lessons", [])
        units = {u["id"]: u for u in meta.get("units", [])}

        if lessons_meta:
            # Use the lessons array in meta.json
            for lm in lessons_meta:
                unit_id = lm.get("unit", "")
                unit_info = units.get(unit_id, {})
                # Determine unit_order from units list position
                unit_order = 1
                for idx, u in enumerate(meta.get("units", [])):
                    if u["id"] == unit_id:
                        unit_order = idx + 1
                        break

                lesson = Lesson(
                    id=lm["id"],
                    course_id=course_id,
                    slug=f"lesson_{lm['order']:02d}",
                    title=lm["title"],
                    unit_name=unit_info.get("title", ""),
                    unit_order=unit_order,
                    lesson_order=lm["order"],
                    content_type="interactive",
                    content_data={},
                    estimated_minutes=20,
                    xp_reward=30,
                )
                db.add(lesson)
        else:
            # Fallback: scan for lesson_XX.json files
            lesson_files = sorted(
                f for f in os.listdir(os.path.join(courses_dir, dirname))
                if f.startswith("lesson_") and f.endswith(".json")
            )
            for lf in lesson_files:
                lf_path = os.path.join(courses_dir, dirname, lf)
                try:
                    with open(lf_path, "r", encoding="utf-8") as f:
                        ldata = json.load(f)
                except (json.JSONDecodeError, OSError):
                    continue

                lesson_id = ldata.get("id", lf.replace(".json", ""))
                unit_id = ldata.get("unit", "")
                unit_info = units.get(unit_id, {})
                unit_order = 1
                for idx, u in enumerate(meta.get("units", [])):
                    if u["id"] == unit_id:
                        unit_order = idx + 1
                        break

                lesson = Lesson(
                    id=lesson_id,
                    course_id=course_id,
                    slug=lf.replace(".json", ""),
                    title=ldata.get("title", ""),
                    unit_name=unit_info.get("title", ""),
                    unit_order=unit_order,
                    lesson_order=ldata.get("order", 1),
                    content_type="interactive",
                    content_data={},
                    estimated_minutes=ldata.get("estimated_minutes", 20),
                    xp_reward=30,
                )
                db.add(lesson)

    db.flush()
    logger.info("Imported %d courses.", count)
    return count


def import_all(db: Session) -> dict:
    """Run all content imports. Returns counts of imported items."""
    results = {}
    results["characters"] = import_characters(db)
    results["puzzles"] = import_puzzles(db)
    results["achievements"] = import_achievements(db)
    results["courses"] = import_courses(db)
    return results
