#!/usr/bin/env python3
"""Migrate data from SQLite to PostgreSQL.

Usage:
    # Dry run (read-only, show counts):
    python3 scripts/migrate_sqlite_to_pg.py --dry-run

    # Execute migration:
    python3 scripts/migrate_sqlite_to_pg.py

    # Specify custom paths:
    python3 scripts/migrate_sqlite_to_pg.py \
        --sqlite-url sqlite:///./data.db \
        --pg-url postgresql://chess:chess_edu_2026@localhost:5432/chess_edu

Requirements:
    - PostgreSQL must be running with the target database created.
    - Tables must already exist in PG (run init_db or alembic upgrade head first).
"""

import argparse
import logging
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, inspect, text, MetaData
from sqlalchemy.orm import sessionmaker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("migrate")

# Migration order: tables grouped by foreign key dependency depth.
# Each batch can be inserted independently; later batches depend on earlier ones.
MIGRATION_ORDER = [
    # Batch 1: no foreign keys
    [
        "users",
        "puzzles",
        "courses",
        "characters",
        "achievements",
        "membership_plans",
    ],
    # Batch 2: depend on batch 1
    [
        "user_profiles",
        "user_ratings",
        "user_streaks",
        "user_daily_quotas",
        "lessons",
        "character_dialogues",
        "invite_codes",
    ],
    # Batch 3: depend on batch 1-2
    [
        "exercises",
        "games",
        "daily_puzzles",
        "user_character_relations",
        "user_achievements",
        "daily_train_plans",
        "notifications",
        "lesson_progresses",
        "adaptive_difficulty_configs",
        "user_weakness_profiles",
    ],
    # Batch 4: depend on batch 1-3
    [
        "game_moves",
        "puzzle_attempts",
        "exercise_attempts",
        "daily_train_records",
        "rating_histories",
        "promotion_challenges",
        "weakness_recommendations",
        "teacher_students",
    ],
]

BATCH_SIZE = 500


def get_all_table_names():
    """Flatten MIGRATION_ORDER into a single list."""
    names = []
    for batch in MIGRATION_ORDER:
        names.extend(batch)
    return names


def migrate(sqlite_url: str, pg_url: str, dry_run: bool = False):
    """Migrate all data from SQLite to PostgreSQL."""

    logger.info("Source (SQLite): %s", sqlite_url)
    logger.info("Target (PG):    %s", pg_url)
    logger.info("Dry run: %s", dry_run)

    # Create engines
    src_engine = create_engine(sqlite_url)
    dst_engine = create_engine(pg_url, pool_pre_ping=True)

    src_inspector = inspect(src_engine)
    dst_inspector = inspect(dst_engine)

    src_tables = set(src_inspector.get_table_names())
    dst_tables = set(dst_inspector.get_table_names())

    # Reflect source metadata
    src_meta = MetaData()
    src_meta.reflect(bind=src_engine)

    SrcSession = sessionmaker(bind=src_engine)
    DstSession = sessionmaker(bind=dst_engine)

    all_ordered = get_all_table_names()
    stats = {}
    errors = []

    for table_name in all_ordered:
        if table_name not in src_tables:
            logger.info("SKIP %s — not in source DB", table_name)
            stats[table_name] = {"src": 0, "dst": 0, "status": "skip_no_src"}
            continue
        if table_name not in dst_tables:
            logger.warning("SKIP %s — not in target DB (run init_db first?)", table_name)
            stats[table_name] = {"src": 0, "dst": 0, "status": "skip_no_dst"}
            continue

        # Count source rows
        with src_engine.connect() as conn:
            src_count = conn.execute(
                text(f"SELECT COUNT(*) FROM \"{table_name}\"")
            ).scalar()

        logger.info("TABLE %-35s  src_rows=%d", table_name, src_count)
        stats[table_name] = {"src": src_count, "dst": 0, "status": "pending"}

        if src_count == 0:
            stats[table_name]["status"] = "empty"
            continue

        if dry_run:
            stats[table_name]["status"] = "dry_run"
            continue

        # Read all rows from source
        src_table = src_meta.tables[table_name]
        col_names = [c.name for c in src_table.columns]

        try:
            with src_engine.connect() as src_conn:
                rows = src_conn.execute(src_table.select()).fetchall()

            # Insert into target in batches
            inserted = 0
            dst_session = DstSession()
            try:
                # Disable FK checks during insert for PG
                dst_session.execute(text("SET session_replication_role = 'replica'"))

                for i in range(0, len(rows), BATCH_SIZE):
                    batch = rows[i:i + BATCH_SIZE]
                    values = [dict(zip(col_names, row)) for row in batch]

                    # Use INSERT ... ON CONFLICT DO NOTHING for idempotency
                    dst_session.execute(src_table.insert().prefix_with(""), values)
                    inserted += len(batch)

                # Re-enable FK checks
                dst_session.execute(text("SET session_replication_role = 'origin'"))
                dst_session.commit()
                logger.info("  -> inserted %d rows", inserted)
            except Exception as e:
                dst_session.rollback()
                logger.error("  -> FAILED: %s", e)
                errors.append((table_name, str(e)))
                stats[table_name]["status"] = "error"
                continue
            finally:
                dst_session.close()

            # Verify target count
            with dst_engine.connect() as conn:
                dst_count = conn.execute(
                    text(f"SELECT COUNT(*) FROM \"{table_name}\"")
                ).scalar()
            stats[table_name]["dst"] = dst_count
            stats[table_name]["status"] = "ok" if dst_count >= src_count else "mismatch"

        except Exception as e:
            logger.error("  -> FAILED reading source: %s", e)
            errors.append((table_name, str(e)))
            stats[table_name]["status"] = "error"

    # Reset sequences for tables with integer PKs (if any)
    if not dry_run:
        _reset_sequences(dst_engine, dst_inspector)

    # Print summary
    print("\n" + "=" * 70)
    print("MIGRATION SUMMARY")
    print("=" * 70)
    print(f"{'Table':<35} {'Source':>8} {'Target':>8} {'Status':>10}")
    print("-" * 70)
    total_src = 0
    total_dst = 0
    for table_name in all_ordered:
        s = stats.get(table_name, {"src": 0, "dst": 0, "status": "unknown"})
        total_src += s["src"]
        total_dst += s["dst"]
        status_marker = ""
        if s["status"] == "ok":
            status_marker = "OK"
        elif s["status"] == "mismatch":
            status_marker = "MISMATCH!"
        elif s["status"] == "error":
            status_marker = "ERROR!"
        elif s["status"] == "dry_run":
            status_marker = "dry_run"
        else:
            status_marker = s["status"]
        print(f"{table_name:<35} {s['src']:>8} {s['dst']:>8} {status_marker:>10}")
    print("-" * 70)
    print(f"{'TOTAL':<35} {total_src:>8} {total_dst:>8}")
    print("=" * 70)

    if errors:
        print(f"\nERRORS ({len(errors)}):")
        for tbl, err in errors:
            print(f"  {tbl}: {err}")
        return 1

    if dry_run:
        print("\nDry run complete. No data was written.")
    else:
        mismatches = [t for t in all_ordered if stats.get(t, {}).get("status") == "mismatch"]
        if mismatches:
            print(f"\nWARNING: Row count mismatch in: {', '.join(mismatches)}")
            return 1
        print("\nMigration completed successfully.")
    return 0


def _reset_sequences(engine, inspector):
    """Reset PostgreSQL sequences for tables with serial/identity columns."""
    logger.info("Resetting PG sequences...")
    with engine.begin() as conn:
        for table_name in inspector.get_table_names():
            columns = inspector.get_columns(table_name)
            for col in columns:
                if col.get("autoincrement", False) and col["name"] == "id":
                    seq_name = f"{table_name}_id_seq"
                    try:
                        conn.execute(text(
                            f"SELECT setval('{seq_name}', COALESCE((SELECT MAX(id) FROM \"{table_name}\"), 0) + 1, false)"
                        ))
                        logger.info("  Reset sequence %s", seq_name)
                    except Exception:
                        # Sequence might not exist (e.g., UUID PKs)
                        pass


def main():
    parser = argparse.ArgumentParser(description="Migrate SQLite data to PostgreSQL")
    parser.add_argument(
        "--sqlite-url",
        default="sqlite:///./data.db",
        help="SQLite connection URL (default: sqlite:///./data.db)",
    )
    parser.add_argument(
        "--pg-url",
        default="postgresql://chess:chess_edu_2026@localhost:5432/chess_edu",
        help="PostgreSQL connection URL",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only read and count rows, do not write to PG",
    )
    args = parser.parse_args()

    sys.exit(migrate(args.sqlite_url, args.pg_url, args.dry_run))


if __name__ == "__main__":
    main()
