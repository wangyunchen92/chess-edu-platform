"""Free play schema changes - add game_type and opponent_name to games,
insert 'none' placeholder character.

Revision ID: 003_free_play
Revises: 002_phase2a
Create Date: 2026-03-30
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003_free_play"
down_revision: Union[str, None] = "002_phase2a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ──────────────────────────────────────────────
    # 1. games — add game_type, opponent_name
    # ──────────────────────────────────────────────
    op.execute("""
    ALTER TABLE games ADD COLUMN game_type VARCHAR(20) NOT NULL DEFAULT 'ai_character';
    """)
    op.execute("""
    ALTER TABLE games ADD COLUMN opponent_name VARCHAR(100) DEFAULT NULL;
    """)

    # ──────────────────────────────────────────────
    # 2. characters — insert 'none' placeholder
    # ──────────────────────────────────────────────
    op.execute("""
    INSERT INTO characters (
        id, slug, name, tier, avatar_key, personality,
        play_style, base_rating, rating_range_min, rating_range_max,
        engine_depth_min, engine_depth_max, mistake_rate, is_free, sort_order
    ) VALUES (
        'none', 'none', '自由对弈', 'system', 'none', '占位角色，不出现在角色大厅',
        'none', 0, 0, 0, 0, 0, 0, 0, 9999
    ) ON CONFLICT (id) DO NOTHING;
    """)


def downgrade() -> None:
    # SQLite does not support DROP COLUMN prior to 3.35.0
    # For safety, downgrade is a no-op; columns remain but are unused.
    pass
