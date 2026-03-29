"""Initial database schema - all Phase 1 tables.

Revision ID: 001_initial
Revises: None
Create Date: 2026-03-28
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ──────────────────────────────────────────────
    # 1. users
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE users (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username        VARCHAR(50) NOT NULL UNIQUE,
        password_hash   VARCHAR(255) NOT NULL,
        nickname        VARCHAR(50) NOT NULL,
        avatar_url      VARCHAR(500),
        role            VARCHAR(20) NOT NULL DEFAULT 'student',
        status          VARCHAR(20) NOT NULL DEFAULT 'active',
        membership_tier VARCHAR(20) NOT NULL DEFAULT 'free',
        membership_expires_at TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at   TIMESTAMPTZ,
        login_count     INTEGER NOT NULL DEFAULT 0,
        created_by      UUID REFERENCES users(id)
    );

    CREATE INDEX idx_users_username ON users(username);
    CREATE INDEX idx_users_status ON users(status);
    CREATE INDEX idx_users_membership ON users(membership_tier);
    """)

    # ──────────────────────────────────────────────
    # 2. user_profiles
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE user_profiles (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        display_name    VARCHAR(50),
        birth_year      INTEGER,
        chess_experience VARCHAR(20) DEFAULT 'none',
        assessment_done  BOOLEAN NOT NULL DEFAULT FALSE,
        initial_rating   INTEGER DEFAULT 300,
        preferred_time   INTEGER DEFAULT 15,
        notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        daily_remind_time    TIME DEFAULT '18:00',
        theme           VARCHAR(20) DEFAULT 'default',
        sound_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    # ──────────────────────────────────────────────
    # 3. user_ratings
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE user_ratings (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        game_rating     INTEGER NOT NULL DEFAULT 300,
        puzzle_rating   INTEGER NOT NULL DEFAULT 300,
        rank_title      VARCHAR(20) NOT NULL DEFAULT 'apprentice_1',
        rank_tier       INTEGER NOT NULL DEFAULT 1,
        rank_region     VARCHAR(30) NOT NULL DEFAULT 'meadow',
        xp_total        INTEGER NOT NULL DEFAULT 0,
        xp_today        INTEGER NOT NULL DEFAULT 0,
        coins           INTEGER NOT NULL DEFAULT 0,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_user_ratings_game_rating ON user_ratings(game_rating DESC);
    CREATE INDEX idx_user_ratings_puzzle_rating ON user_ratings(puzzle_rating DESC);
    """)

    # ──────────────────────────────────────────────
    # 4. rating_histories
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE rating_histories (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating_type     VARCHAR(10) NOT NULL,
        old_rating      INTEGER NOT NULL,
        new_rating      INTEGER NOT NULL,
        change_amount   INTEGER NOT NULL,
        source_type     VARCHAR(20) NOT NULL,
        source_id       UUID,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_rating_histories_user_created ON rating_histories(user_id, created_at DESC);
    """)

    # ──────────────────────────────────────────────
    # 5. user_streaks
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE user_streaks (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        login_streak        INTEGER NOT NULL DEFAULT 0,
        login_streak_max    INTEGER NOT NULL DEFAULT 0,
        train_streak        INTEGER NOT NULL DEFAULT 0,
        train_streak_max    INTEGER NOT NULL DEFAULT 0,
        last_login_date     DATE,
        last_train_date     DATE,
        total_train_days    INTEGER NOT NULL DEFAULT 0,
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    # ──────────────────────────────────────────────
    # 6. characters
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE characters (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug            VARCHAR(30) NOT NULL UNIQUE,
        name            VARCHAR(20) NOT NULL,
        tier            VARCHAR(20) NOT NULL,
        avatar_key      VARCHAR(50) NOT NULL,
        personality     TEXT NOT NULL,
        play_style      VARCHAR(20) NOT NULL,
        base_rating     INTEGER NOT NULL,
        rating_range_min INTEGER NOT NULL,
        rating_range_max INTEGER NOT NULL,
        engine_depth_min INTEGER NOT NULL DEFAULT 1,
        engine_depth_max INTEGER NOT NULL DEFAULT 5,
        mistake_rate    DECIMAL(3,2) NOT NULL DEFAULT 0.30,
        unlock_condition JSONB NOT NULL DEFAULT '{}',
        is_free         BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order      INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    # ──────────────────────────────────────────────
    # 7. character_dialogues
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE character_dialogues (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        character_id    UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        scene           VARCHAR(30) NOT NULL,
        content         TEXT NOT NULL,
        emotion         VARCHAR(20) NOT NULL DEFAULT 'normal',
        sort_order      INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_char_dialogues_char_scene ON character_dialogues(character_id, scene);
    """)

    # ──────────────────────────────────────────────
    # 8. user_character_relations
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE user_character_relations (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        character_id    UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        is_unlocked     BOOLEAN NOT NULL DEFAULT FALSE,
        unlocked_at     TIMESTAMPTZ,
        affinity        INTEGER NOT NULL DEFAULT 0,
        games_played    INTEGER NOT NULL DEFAULT 0,
        games_won       INTEGER NOT NULL DEFAULT 0,
        games_lost      INTEGER NOT NULL DEFAULT 0,
        games_drawn     INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, character_id)
    );

    CREATE INDEX idx_user_char_rel_user ON user_character_relations(user_id);
    """)

    # ──────────────────────────────────────────────
    # 9. games
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE games (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        character_id    UUID NOT NULL REFERENCES characters(id),
        user_color      VARCHAR(5) NOT NULL DEFAULT 'white',
        time_control    INTEGER NOT NULL DEFAULT 600,
        time_increment  INTEGER NOT NULL DEFAULT 0,
        status          VARCHAR(20) NOT NULL DEFAULT 'playing',
        result          VARCHAR(20),
        result_reason   VARCHAR(30),
        pgn             TEXT,
        final_fen       VARCHAR(100),
        total_moves     INTEGER DEFAULT 0,
        user_rating_before  INTEGER,
        user_rating_after   INTEGER,
        rating_change   INTEGER DEFAULT 0,
        ai_rating_used  INTEGER,
        hints_used      INTEGER NOT NULL DEFAULT 0,
        review_data     JSONB,
        started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at        TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_games_user_created ON games(user_id, created_at DESC);
    CREATE INDEX idx_games_user_status ON games(user_id, status);
    CREATE INDEX idx_games_character ON games(character_id);
    """)

    # ──────────────────────────────────────────────
    # 10. game_moves
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE game_moves (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        move_number     INTEGER NOT NULL,
        side            VARCHAR(5) NOT NULL,
        move_san        VARCHAR(10) NOT NULL,
        move_uci        VARCHAR(10) NOT NULL,
        fen_after       VARCHAR(100) NOT NULL,
        eval_score      INTEGER,
        is_best_move    BOOLEAN,
        is_mistake      BOOLEAN DEFAULT FALSE,
        is_blunder      BOOLEAN DEFAULT FALSE,
        is_key_moment   BOOLEAN DEFAULT FALSE,
        time_spent_ms   INTEGER,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_game_moves_game ON game_moves(game_id, move_number);
    """)

    # ──────────────────────────────────────────────
    # 11. puzzles
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE puzzles (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        puzzle_code     VARCHAR(20) NOT NULL UNIQUE,
        fen             VARCHAR(100) NOT NULL,
        solution_moves  TEXT NOT NULL,
        difficulty_level INTEGER NOT NULL,
        rating          INTEGER NOT NULL DEFAULT 1000,
        themes          VARCHAR(200),
        description     TEXT,
        hint_text       TEXT,
        explanation     TEXT,
        side_to_move    VARCHAR(5) NOT NULL,
        move_count      INTEGER NOT NULL,
        source          VARCHAR(50),
        is_daily_pool   BOOLEAN NOT NULL DEFAULT FALSE,
        is_challenge    BOOLEAN NOT NULL DEFAULT TRUE,
        challenge_order INTEGER,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_puzzles_difficulty ON puzzles(difficulty_level, challenge_order);
    CREATE INDEX idx_puzzles_rating ON puzzles(rating);
    CREATE INDEX idx_puzzles_daily ON puzzles(is_daily_pool) WHERE is_daily_pool = TRUE;
    """)

    # ──────────────────────────────────────────────
    # 12. daily_puzzles
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE daily_puzzles (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        puzzle_date     DATE NOT NULL,
        puzzle_id       UUID NOT NULL REFERENCES puzzles(id),
        sort_order      INTEGER NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(puzzle_date, sort_order)
    );

    CREATE INDEX idx_daily_puzzles_date ON daily_puzzles(puzzle_date);
    """)

    # ──────────────────────────────────────────────
    # 13. puzzle_attempts
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE puzzle_attempts (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        puzzle_id       UUID NOT NULL REFERENCES puzzles(id),
        is_correct      BOOLEAN NOT NULL,
        user_moves      TEXT,
        attempt_count   INTEGER NOT NULL DEFAULT 1,
        time_spent_ms   INTEGER,
        hint_used       BOOLEAN NOT NULL DEFAULT FALSE,
        rating_before   INTEGER,
        rating_after    INTEGER,
        rating_change   INTEGER DEFAULT 0,
        source          VARCHAR(20) NOT NULL DEFAULT 'challenge',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_puzzle_attempts_user ON puzzle_attempts(user_id, created_at DESC);
    CREATE INDEX idx_puzzle_attempts_user_puzzle ON puzzle_attempts(user_id, puzzle_id);
    CREATE INDEX idx_puzzle_attempts_wrong ON puzzle_attempts(user_id, is_correct) WHERE is_correct = FALSE;
    """)

    # ──────────────────────────────────────────────
    # 14. courses
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE courses (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug            VARCHAR(30) NOT NULL UNIQUE,
        title           VARCHAR(100) NOT NULL,
        description     TEXT,
        level           INTEGER NOT NULL,
        prerequisite_id UUID REFERENCES courses(id),
        total_lessons   INTEGER NOT NULL,
        is_free         BOOLEAN NOT NULL DEFAULT FALSE,
        membership_required VARCHAR(20),
        sort_order      INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    # ──────────────────────────────────────────────
    # 15. lessons
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE lessons (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        slug            VARCHAR(50) NOT NULL,
        title           VARCHAR(100) NOT NULL,
        unit_name       VARCHAR(50),
        unit_order      INTEGER NOT NULL DEFAULT 1,
        lesson_order    INTEGER NOT NULL,
        content_type    VARCHAR(20) NOT NULL DEFAULT 'interactive',
        content_data    JSONB NOT NULL,
        ai_teaching_prompt TEXT,
        estimated_minutes INTEGER DEFAULT 10,
        xp_reward       INTEGER NOT NULL DEFAULT 30,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(course_id, lesson_order)
    );

    CREATE INDEX idx_lessons_course_order ON lessons(course_id, lesson_order);
    """)

    # ──────────────────────────────────────────────
    # 16. exercises
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE exercises (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lesson_id       UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        exercise_order  INTEGER NOT NULL,
        exercise_type   VARCHAR(20) NOT NULL,
        question_text   TEXT NOT NULL,
        fen             VARCHAR(100),
        options         JSONB,
        correct_answer  TEXT NOT NULL,
        explanation     TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(lesson_id, exercise_order)
    );
    """)

    # ──────────────────────────────────────────────
    # 17. lesson_progresses
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE lesson_progresses (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id       UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        status          VARCHAR(20) NOT NULL DEFAULT 'not_started',
        progress_pct    INTEGER NOT NULL DEFAULT 0,
        exercise_score  INTEGER,
        exercise_total  INTEGER,
        started_at      TIMESTAMPTZ,
        completed_at    TIMESTAMPTZ,
        last_position   JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, lesson_id)
    );

    CREATE INDEX idx_lesson_progress_user ON lesson_progresses(user_id);
    CREATE INDEX idx_lesson_progress_user_status ON lesson_progresses(user_id, status);
    """)

    # ──────────────────────────────────────────────
    # 18. exercise_attempts
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE exercise_attempts (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exercise_id     UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        user_answer     TEXT NOT NULL,
        is_correct      BOOLEAN NOT NULL,
        time_spent_ms   INTEGER,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_exercise_attempts_user ON exercise_attempts(user_id, created_at DESC);
    """)

    # ──────────────────────────────────────────────
    # 19. daily_train_plans
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE daily_train_plans (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_date       DATE NOT NULL,
        template_type   VARCHAR(20) NOT NULL DEFAULT 'standard',
        items           JSONB NOT NULL,
        total_items     INTEGER NOT NULL DEFAULT 3,
        completed_items INTEGER NOT NULL DEFAULT 0,
        is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
        total_minutes   INTEGER NOT NULL DEFAULT 25,
        actual_minutes  INTEGER NOT NULL DEFAULT 0,
        xp_earned       INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, plan_date)
    );

    CREATE INDEX idx_daily_train_plans_user_date ON daily_train_plans(user_id, plan_date DESC);
    """)

    # ──────────────────────────────────────────────
    # 20. daily_train_records
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE daily_train_records (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id         UUID NOT NULL REFERENCES daily_train_plans(id) ON DELETE CASCADE,
        item_index      INTEGER NOT NULL,
        item_type       VARCHAR(20) NOT NULL,
        started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at    TIMESTAMPTZ,
        duration_ms     INTEGER,
        result_data     JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_daily_train_records_user ON daily_train_records(user_id, created_at DESC);
    CREATE INDEX idx_daily_train_records_plan ON daily_train_records(plan_id);
    """)

    # ──────────────────────────────────────────────
    # 21. achievements
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE achievements (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug            VARCHAR(50) NOT NULL UNIQUE,
        name            VARCHAR(50) NOT NULL,
        description     TEXT NOT NULL,
        icon_key        VARCHAR(50) NOT NULL,
        category        VARCHAR(20) NOT NULL,
        condition_type  VARCHAR(30) NOT NULL,
        condition_value INTEGER NOT NULL,
        xp_reward       INTEGER NOT NULL DEFAULT 50,
        coin_reward     INTEGER NOT NULL DEFAULT 100,
        rarity          VARCHAR(10) NOT NULL DEFAULT 'common',
        sort_order      INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    # ──────────────────────────────────────────────
    # 22. user_achievements
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE user_achievements (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        achievement_id  UUID NOT NULL REFERENCES achievements(id),
        achieved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_displayed    BOOLEAN NOT NULL DEFAULT FALSE,
        UNIQUE(user_id, achievement_id)
    );

    CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
    """)

    # ──────────────────────────────────────────────
    # 23. membership_plans
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE membership_plans (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug            VARCHAR(30) NOT NULL UNIQUE,
        name            VARCHAR(50) NOT NULL,
        tier            VARCHAR(20) NOT NULL,
        billing_period  VARCHAR(10) NOT NULL,
        price_cents     INTEGER NOT NULL DEFAULT 0,
        original_price_cents INTEGER,
        features        JSONB NOT NULL DEFAULT '{}',
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order      INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    # ──────────────────────────────────────────────
    # 24. notifications
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE notifications (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type            VARCHAR(30) NOT NULL,
        title           VARCHAR(100) NOT NULL,
        content         TEXT NOT NULL,
        is_read         BOOLEAN NOT NULL DEFAULT FALSE,
        extra_data      JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
    """)

    # ──────────────────────────────────────────────
    # 25. user_daily_quotas
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE user_daily_quotas (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quota_date      DATE NOT NULL,
        games_played    INTEGER NOT NULL DEFAULT 0,
        puzzles_solved  INTEGER NOT NULL DEFAULT 0,
        ai_qa_count     INTEGER NOT NULL DEFAULT 0,
        xp_earned       INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, quota_date)
    );

    CREATE INDEX idx_user_daily_quotas_user_date ON user_daily_quotas(user_id, quota_date);
    """)

    # ──────────────────────────────────────────────
    # 26. promotion_challenges
    # ──────────────────────────────────────────────
    op.execute("""
    CREATE TABLE promotion_challenges (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        challenge_type  VARCHAR(30) NOT NULL,
        target_rank     VARCHAR(20) NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'pending',
        game_id         UUID REFERENCES games(id),
        quiz_answers    JSONB,
        quiz_score      INTEGER,
        attempt_count   INTEGER NOT NULL DEFAULT 1,
        passed_at       TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_promotion_challenges_user ON promotion_challenges(user_id, challenge_type);
    """)


def downgrade() -> None:
    tables = [
        "promotion_challenges",
        "user_daily_quotas",
        "notifications",
        "membership_plans",
        "user_achievements",
        "achievements",
        "daily_train_records",
        "daily_train_plans",
        "exercise_attempts",
        "lesson_progresses",
        "exercises",
        "lessons",
        "courses",
        "puzzle_attempts",
        "daily_puzzles",
        "puzzles",
        "game_moves",
        "games",
        "user_character_relations",
        "character_dialogues",
        "characters",
        "user_streaks",
        "rating_histories",
        "user_ratings",
        "user_profiles",
        "users",
    ]
    for table in tables:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
