"""Migration script: create user_remarks table if not exists."""

import os
import sys

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import inspect, text
from app.database import engine


def migrate():
    inspector = inspect(engine)

    if inspector.has_table("user_remarks"):
        print("Table 'user_remarks' already exists, skipping creation.")
        return

    ddl = """
    CREATE TABLE user_remarks (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        target_user_id VARCHAR(36) NOT NULL,
        remark_name VARCHAR(50) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """

    with engine.begin() as conn:
        conn.execute(text(ddl))
        conn.execute(text(
            "CREATE UNIQUE INDEX uq_user_remark ON user_remarks (user_id, target_user_id)"
        ))

    print("Table 'user_remarks' created successfully with unique index.")


if __name__ == "__main__":
    migrate()
