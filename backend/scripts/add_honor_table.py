"""Migration script: create honor_records table if not exists."""

import os
import sys

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import inspect, text
from app.database import engine


def migrate():
    inspector = inspect(engine)

    if inspector.has_table("honor_records"):
        print("Table 'honor_records' already exists, skipping creation.")
        return

    ddl = """
    CREATE TABLE honor_records (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        type VARCHAR(20) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        rank VARCHAR(50),
        competition_name VARCHAR(200),
        competition_date DATE,
        milestone_key VARCHAR(50),
        milestone_value INTEGER,
        is_public BOOLEAN NOT NULL DEFAULT 1,
        created_by VARCHAR(36),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
    )
    """

    with engine.begin() as conn:
        conn.execute(text(ddl))
        conn.execute(text(
            "CREATE INDEX ix_honor_records_user_id ON honor_records (user_id)"
        ))
        conn.execute(text(
            "CREATE UNIQUE INDEX uq_honor_user_milestone ON honor_records (user_id, milestone_key)"
        ))

    print("Table 'honor_records' created successfully with indexes.")


if __name__ == "__main__":
    migrate()
