"""Phase 2a schema changes - new fields and tables for AI characters,
weakness diagnosis, and adaptive difficulty.

Revision ID: 002_phase2a
Revises: 001_initial
Create Date: 2026-03-30
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_phase2a"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ──────────────────────────────────────────────
    # 1. characters — add play_style_params, unlock_story, region
    # ──────────────────────────────────────────────
    op.execute("""
    ALTER TABLE characters ADD COLUMN play_style_params JSON DEFAULT '{}';
    """)
    op.execute("""
    ALTER TABLE characters ADD COLUMN unlock_story TEXT DEFAULT NULL;
    """)
    op.execute("""
    ALTER TABLE characters ADD COLUMN region VARCHAR(30) NOT NULL DEFAULT 'meadow';
    """)

    # ──────────────────────────────────────────────
    # 2. user_character_relations — add affinity_level
    # ──────────────────────────────────────────────
    op.execute("""
    ALTER TABLE user_character_relations ADD COLUMN affinity_level VARCHAR(20) NOT NULL DEFAULT 'stranger';
    """)

    # ──────────────────────────────────────────────
    # 3. games — add difficulty_mode, adaptive_params
    # ──────────────────────────────────────────────
    op.execute("""
    ALTER TABLE games ADD COLUMN difficulty_mode VARCHAR(20) DEFAULT 'normal';
    """)
    op.execute("""
    ALTER TABLE games ADD COLUMN adaptive_params JSON DEFAULT NULL;
    """)

    # ──────────────────────────────────────────────
    # 4. game_moves — add move_classification, game_phase
    # ──────────────────────────────────────────────
    op.execute("""
    ALTER TABLE game_moves ADD COLUMN move_classification VARCHAR(20) DEFAULT NULL;
    """)
    op.execute("""
    ALTER TABLE game_moves ADD COLUMN game_phase VARCHAR(10) DEFAULT NULL;
    """)

    # ──────────────────────────────────────────────
    # 5. user_weakness_profiles (new table)
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS user_weakness_profiles (
        id              VARCHAR(36) PRIMARY KEY,
        user_id         VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        opening_score           INTEGER NOT NULL DEFAULT 50,
        middlegame_tactics_score INTEGER NOT NULL DEFAULT 50,
        middlegame_strategy_score INTEGER NOT NULL DEFAULT 50,
        endgame_score           INTEGER NOT NULL DEFAULT 50,
        time_management_score   INTEGER NOT NULL DEFAULT 50,

        theme_scores    JSON NOT NULL DEFAULT '{}',

        games_analyzed  INTEGER NOT NULL DEFAULT 0,
        puzzles_analyzed INTEGER NOT NULL DEFAULT 0,

        weakest_dimensions JSON NOT NULL DEFAULT '[]',

        confidence      VARCHAR(10) NOT NULL DEFAULT 'low',

        last_analyzed_at TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(user_id)
    );
    """)

    # ──────────────────────────────────────────────
    # 6. weakness_recommendations (new table)
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS weakness_recommendations (
        id              VARCHAR(36) PRIMARY KEY,
        user_id         VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        weakness_dimension VARCHAR(30) NOT NULL,
        recommendation_type VARCHAR(20) NOT NULL,
        target_id       VARCHAR(36) DEFAULT NULL,
        target_label    VARCHAR(100) NOT NULL,
        reason          TEXT,
        priority        INTEGER NOT NULL DEFAULT 0,
        status          VARCHAR(20) NOT NULL DEFAULT 'active',

        created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # ──────────────────────────────────────────────
    # 7. adaptive_difficulty_configs (new table)
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS adaptive_difficulty_configs (
        id              VARCHAR(36) PRIMARY KEY,
        user_id         VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        character_id    VARCHAR(36) NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

        recent_results  JSON NOT NULL DEFAULT '[]',
        recent_win_rate DECIMAL(3,2) NOT NULL DEFAULT 0.50,

        current_rating_offset INTEGER NOT NULL DEFAULT 0,
        current_depth_adjustment INTEGER NOT NULL DEFAULT 0,
        current_mistake_rate_adjustment DECIMAL(3,2) NOT NULL DEFAULT 0.00,

        adjustment_count INTEGER NOT NULL DEFAULT 0,

        last_adjusted_at TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(user_id, character_id)
    );
    """)


def downgrade() -> None:
    # Drop new tables
    op.execute("DROP TABLE IF EXISTS adaptive_difficulty_configs;")
    op.execute("DROP TABLE IF EXISTS weakness_recommendations;")
    op.execute("DROP TABLE IF EXISTS user_weakness_profiles;")

    # Note: SQLite does not support DROP COLUMN.
    # For development with SQLite, re-create the database from scratch.
    # For PostgreSQL, uncomment below:
    # op.execute("ALTER TABLE game_moves DROP COLUMN IF EXISTS game_phase;")
    # op.execute("ALTER TABLE game_moves DROP COLUMN IF EXISTS move_classification;")
    # op.execute("ALTER TABLE games DROP COLUMN IF EXISTS adaptive_params;")
    # op.execute("ALTER TABLE games DROP COLUMN IF EXISTS difficulty_mode;")
    # op.execute("ALTER TABLE user_character_relations DROP COLUMN IF EXISTS affinity_level;")
    # op.execute("ALTER TABLE characters DROP COLUMN IF EXISTS region;")
    # op.execute("ALTER TABLE characters DROP COLUMN IF EXISTS unlock_story;")
    # op.execute("ALTER TABLE characters DROP COLUMN IF EXISTS play_style_params;")
