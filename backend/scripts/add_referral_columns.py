"""Add referral_code and referred_by columns to users table (SQLite migration)."""

import sqlite3
import os
import sys


def main():
    # Resolve data.db path relative to the backend directory
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(backend_dir, "data.db")

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}, skipping migration.")
        sys.exit(0)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check existing columns
    cursor.execute("PRAGMA table_info(users)")
    columns = {row[1] for row in cursor.fetchall()}

    if "referral_code" not in columns:
        cursor.execute(
            "ALTER TABLE users ADD COLUMN referral_code VARCHAR(6)"
        )
        # SQLite cannot add UNIQUE constraint via ALTER TABLE,
        # so we create a unique index separately.
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_referral_code "
            "ON users(referral_code)"
        )
        print("Added column: referral_code (with unique index)")
    else:
        print("Column referral_code already exists, skipping.")

    if "referred_by" not in columns:
        cursor.execute(
            "ALTER TABLE users ADD COLUMN referred_by VARCHAR(36) REFERENCES users(id)"
        )
        print("Added column: referred_by")
    else:
        print("Column referred_by already exists, skipping.")

    conn.commit()
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    main()
