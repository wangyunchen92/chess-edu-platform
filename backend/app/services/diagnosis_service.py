"""Weakness diagnosis service (Phase 2a F3).

Analyzes game_moves and puzzle_attempts to produce a user weakness profile,
and generates training recommendations based on identified weaknesses.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models.diagnosis import UserWeaknessProfile, WeaknessRecommendation
from app.models.game import Game, GameMove
from app.models.puzzle import Puzzle, PuzzleAttempt
from app.schemas.diagnosis import (
    AnalyzeChangeItem,
    AnalyzeResponse,
    DiagnosisSummaryResponse,
    DimensionScores,
    PrimaryWeakness,
    RecommendationItem,
    ThemeScoreItem,
    UpdateRecommendationResponse,
    WeaknessProfileResponse,
)

MIN_GAMES = 10
MIN_PUZZLES = 30

# Dimension labels for display
DIMENSION_LABELS = {
    "opening": "开局",
    "middlegame_tactics": "中局战术",
    "middlegame_strategy": "中局战略",
    "endgame": "残局",
    "time_management": "时间管理",
}

# Theme labels for display
THEME_LABELS = {
    "fork": "双重攻击",
    "pin": "牵制",
    "skewer": "串击",
    "discovered_attack": "闪击",
    "back_rank_mate": "底线杀",
    "deflection": "引离",
    "attraction": "引入",
    "sacrifice": "弃子",
    "mate_in_1": "一步杀",
    "mate_in_2": "两步杀",
    "endgame": "残局",
    "pawn_endgame": "兵残局",
    "opening": "开局",
}


def get_profile(db: Session, user_id: str) -> WeaknessProfileResponse:
    """Get user's weakness profile, or return insufficient-data message."""
    profile = db.execute(
        select(UserWeaknessProfile).where(UserWeaknessProfile.user_id == user_id)
    ).scalar_one_or_none()

    # Count actual data
    games_count = db.execute(
        select(func.count()).select_from(Game).where(
            Game.user_id == user_id, Game.status == "completed"
        )
    ).scalar() or 0

    puzzles_count = db.execute(
        select(func.count()).select_from(PuzzleAttempt).where(
            PuzzleAttempt.user_id == user_id
        )
    ).scalar() or 0

    if profile is None or profile.confidence == "low":
        if games_count < MIN_GAMES or puzzles_count < MIN_PUZZLES:
            return WeaknessProfileResponse(
                confidence="low",
                games_analyzed=games_count,
                puzzles_analyzed=puzzles_count,
                min_games_required=MIN_GAMES,
                min_puzzles_required=MIN_PUZZLES,
                message="需要更多对弈和解题数据才能生成准确的弱点诊断",
            )

    if profile is None:
        # Enough data but no profile yet — trigger analysis
        return WeaknessProfileResponse(
            confidence="low",
            games_analyzed=games_count,
            puzzles_analyzed=puzzles_count,
            message="尚未进行分析，请点击分析按钮",
        )

    # Build theme_scores response
    theme_scores_resp = {}
    for key, val in (profile.theme_scores or {}).items():
        if isinstance(val, dict):
            theme_scores_resp[key] = ThemeScoreItem(
                score=val.get("score", 0),
                correct=val.get("correct", 0),
                total=val.get("total", 0),
            )

    return WeaknessProfileResponse(
        user_id=user_id,
        confidence=profile.confidence,
        scores=DimensionScores(
            opening=profile.opening_score,
            middlegame_tactics=profile.middlegame_tactics_score,
            middlegame_strategy=profile.middlegame_strategy_score,
            endgame=profile.endgame_score,
            time_management=profile.time_management_score,
        ),
        theme_scores=theme_scores_resp if theme_scores_resp else None,
        weakest_dimensions=profile.weakest_dimensions or [],
        games_analyzed=profile.games_analyzed,
        puzzles_analyzed=profile.puzzles_analyzed,
        last_analyzed_at=profile.last_analyzed_at,
    )


def analyze(db: Session, user_id: str, force: bool = False) -> AnalyzeResponse:
    """Run weakness analysis for a user."""
    # Count data
    games_count = db.execute(
        select(func.count()).select_from(Game).where(
            Game.user_id == user_id, Game.status == "completed"
        )
    ).scalar() or 0

    puzzles_count = db.execute(
        select(func.count()).select_from(PuzzleAttempt).where(
            PuzzleAttempt.user_id == user_id
        )
    ).scalar() or 0

    if games_count < MIN_GAMES and puzzles_count < MIN_PUZZLES and not force:
        return AnalyzeResponse(analyzed=False, games_analyzed=games_count, puzzles_analyzed=puzzles_count)

    # Get or create profile
    profile = db.execute(
        select(UserWeaknessProfile).where(UserWeaknessProfile.user_id == user_id)
    ).scalar_one_or_none()

    old_scores = {}
    if profile:
        old_scores = {
            "opening": profile.opening_score,
            "middlegame_tactics": profile.middlegame_tactics_score,
            "middlegame_strategy": profile.middlegame_strategy_score,
            "endgame": profile.endgame_score,
            "time_management": profile.time_management_score,
        }
    else:
        profile = UserWeaknessProfile(
            id=str(uuid.uuid4()),
            user_id=user_id,
        )
        db.add(profile)
        db.flush()
        old_scores = {k: 50 for k in ["opening", "middlegame_tactics", "middlegame_strategy", "endgame", "time_management"]}

    # === Calculate dimension scores ===

    # 1. Opening score: based on game_moves in opening phase
    opening_score = _calc_phase_score(db, user_id, "opening")

    # 2. Middlegame tactics: weighted puzzle accuracy + middlegame move quality
    puzzle_accuracy = _calc_puzzle_accuracy(db, user_id)
    middlegame_move_score = _calc_phase_score(db, user_id, "middlegame")
    middlegame_tactics_score = int(0.6 * puzzle_accuracy + 0.4 * middlegame_move_score)

    # 3. Middlegame strategy: based on game length and middlegame eval trends
    middlegame_strategy_score = _calc_strategy_score(db, user_id)

    # 4. Endgame score
    endgame_score = _calc_phase_score(db, user_id, "endgame")

    # 5. Time management
    time_management_score = _calc_time_management_score(db, user_id)

    # === Calculate theme scores ===
    theme_scores = _calc_theme_scores(db, user_id)

    # === Determine confidence ===
    if games_count >= 30 and puzzles_count >= 100:
        confidence = "high"
    elif games_count >= 10 and puzzles_count >= 30:
        confidence = "medium"
    else:
        confidence = "low"

    # === Find weakest dimensions ===
    all_scores = {
        "opening": opening_score,
        "middlegame_tactics": middlegame_tactics_score,
        "middlegame_strategy": middlegame_strategy_score,
        "endgame": endgame_score,
        "time_management": time_management_score,
    }
    # Also include low theme scores
    theme_candidates = []
    for key, val in theme_scores.items():
        if val.get("total", 0) >= 5:
            theme_candidates.append((key, val.get("score", 50)))

    # Combine dimension and theme scores, sort ascending
    combined = [(k, v) for k, v in all_scores.items()]
    combined.extend(theme_candidates)
    combined.sort(key=lambda x: x[1])
    weakest = [c[0] for c in combined[:3]]

    # === Update profile ===
    profile.opening_score = opening_score
    profile.middlegame_tactics_score = middlegame_tactics_score
    profile.middlegame_strategy_score = middlegame_strategy_score
    profile.endgame_score = endgame_score
    profile.time_management_score = time_management_score
    profile.theme_scores = theme_scores
    flag_modified(profile, "theme_scores")
    profile.games_analyzed = games_count
    profile.puzzles_analyzed = puzzles_count
    profile.weakest_dimensions = weakest
    flag_modified(profile, "weakest_dimensions")
    profile.confidence = confidence
    profile.last_analyzed_at = datetime.now(timezone.utc)
    db.add(profile)
    db.flush()

    # === Generate recommendations ===
    _generate_recommendations(db, user_id, all_scores, theme_scores, weakest)

    # === Build changes ===
    changes = []
    new_scores = all_scores
    for dim in new_scores:
        old_val = old_scores.get(dim, 50)
        new_val = new_scores[dim]
        if old_val != new_val:
            trend = "up" if new_val > old_val else "down" if new_val < old_val else "stable"
            changes.append(AnalyzeChangeItem(
                dimension=dim, old_score=old_val, new_score=new_val, trend=trend
            ))

    return AnalyzeResponse(
        analyzed=True,
        games_analyzed=games_count,
        puzzles_analyzed=puzzles_count,
        changes=changes,
    )


def get_recommendations(
    db: Session, user_id: str, limit: int = 5, status: str = "active"
) -> list[RecommendationItem]:
    """Get weakness-based recommendations for a user."""
    stmt = (
        select(WeaknessRecommendation)
        .where(
            WeaknessRecommendation.user_id == user_id,
            WeaknessRecommendation.status == status,
        )
        .order_by(WeaknessRecommendation.priority)
        .limit(limit)
    )
    recs = db.execute(stmt).scalars().all()
    return [
        RecommendationItem(
            id=r.id,
            weakness_dimension=r.weakness_dimension,
            recommendation_type=r.recommendation_type,
            target_id=r.target_id,
            target_label=r.target_label,
            reason=r.reason,
            priority=r.priority,
            status=r.status,
        )
        for r in recs
    ]


def update_recommendation(
    db: Session, user_id: str, rec_id: str, new_status: str
) -> Optional[UpdateRecommendationResponse]:
    """Update a recommendation's status."""
    stmt = select(WeaknessRecommendation).where(
        WeaknessRecommendation.id == rec_id,
        WeaknessRecommendation.user_id == user_id,
    )
    rec = db.execute(stmt).scalar_one_or_none()
    if rec is None:
        return None

    rec.status = new_status
    db.add(rec)
    db.flush()
    return UpdateRecommendationResponse(id=rec.id, status=rec.status)


def get_summary(db: Session, user_id: str) -> DiagnosisSummaryResponse:
    """Get a lightweight diagnosis summary for the dashboard."""
    profile = db.execute(
        select(UserWeaknessProfile).where(UserWeaknessProfile.user_id == user_id)
    ).scalar_one_or_none()

    if profile is None or profile.confidence == "low":
        return DiagnosisSummaryResponse(has_diagnosis=False)

    # Find primary weakness
    weakest = profile.weakest_dimensions or []
    primary = None
    if weakest:
        dim = weakest[0]
        score = _get_dimension_score(profile, dim)
        label = DIMENSION_LABELS.get(dim, THEME_LABELS.get(dim, dim))
        suggestion = _get_suggestion_for_dimension(dim)
        primary = PrimaryWeakness(
            dimension=dim, label=label, score=score, suggestion=suggestion
        )

    # Count active recommendations
    active_count = db.execute(
        select(func.count()).select_from(WeaknessRecommendation).where(
            WeaknessRecommendation.user_id == user_id,
            WeaknessRecommendation.status == "active",
        )
    ).scalar() or 0

    return DiagnosisSummaryResponse(
        has_diagnosis=True,
        confidence=profile.confidence,
        primary_weakness=primary,
        active_recommendations_count=active_count,
    )


# ── Private helpers ─────────────────────────────────────────────


def _calc_phase_score(db: Session, user_id: str, phase: str) -> int:
    """Calculate accuracy score for a game phase based on move classifications."""
    # Get all user's games
    game_ids_stmt = select(Game.id).where(
        Game.user_id == user_id, Game.status == "completed"
    )
    game_ids = [r[0] for r in db.execute(game_ids_stmt).all()]
    if not game_ids:
        return 50

    # Count total moves and mistakes in this phase for the user's side
    total_stmt = select(func.count()).select_from(GameMove).where(
        GameMove.game_id.in_(game_ids),
    )
    if phase != "middlegame":
        total_stmt = total_stmt.where(GameMove.game_phase == phase)
    else:
        total_stmt = total_stmt.where(GameMove.game_phase == "middlegame")

    total_moves = db.execute(total_stmt).scalar() or 0
    if total_moves == 0:
        return 50

    mistake_stmt = select(func.count()).select_from(GameMove).where(
        GameMove.game_id.in_(game_ids),
        (GameMove.is_mistake.is_(True)) | (GameMove.is_blunder.is_(True)),
    )
    if phase != "middlegame":
        mistake_stmt = mistake_stmt.where(GameMove.game_phase == phase)
    else:
        mistake_stmt = mistake_stmt.where(GameMove.game_phase == "middlegame")

    mistakes = db.execute(mistake_stmt).scalar() or 0

    mistake_rate = mistakes / total_moves if total_moves > 0 else 0
    score = max(0, min(100, int(100 - mistake_rate * 100)))
    return score


def _calc_puzzle_accuracy(db: Session, user_id: str) -> int:
    """Calculate overall puzzle accuracy as a score 0-100."""
    total_stmt = select(func.count()).select_from(PuzzleAttempt).where(
        PuzzleAttempt.user_id == user_id
    )
    total = db.execute(total_stmt).scalar() or 0
    if total == 0:
        return 50

    correct_stmt = select(func.count()).select_from(PuzzleAttempt).where(
        PuzzleAttempt.user_id == user_id,
        PuzzleAttempt.is_correct.is_(True),
    )
    correct = db.execute(correct_stmt).scalar() or 0
    return int(correct / total * 100) if total > 0 else 50


def _calc_strategy_score(db: Session, user_id: str) -> int:
    """Calculate middlegame strategy score.

    Based on average game length and eval trends in middlegame.
    Longer games with stable eval suggest better strategic understanding.
    """
    stmt = select(func.avg(Game.total_moves)).where(
        Game.user_id == user_id, Game.status == "completed"
    )
    avg_moves = db.execute(stmt).scalar()
    if avg_moves is None:
        return 50

    # Heuristic: games around 30-40 moves suggest decent strategy
    # Very short games (< 15) suggest poor strategy
    avg_moves = float(avg_moves)
    if avg_moves >= 35:
        base_score = 70
    elif avg_moves >= 25:
        base_score = 55
    elif avg_moves >= 15:
        base_score = 40
    else:
        base_score = 25

    # Adjust by middlegame mistake rate
    phase_score = _calc_phase_score(db, user_id, "middlegame")
    return int(0.4 * base_score + 0.6 * phase_score)


def _calc_time_management_score(db: Session, user_id: str) -> int:
    """Calculate time management score based on move time consistency."""
    game_ids_stmt = select(Game.id).where(
        Game.user_id == user_id, Game.status == "completed"
    )
    game_ids = [r[0] for r in db.execute(game_ids_stmt).all()]
    if not game_ids:
        return 50

    # Get average and stddev of time_spent_ms
    stmt = select(
        func.avg(GameMove.time_spent_ms),
        func.count(GameMove.id),
    ).where(
        GameMove.game_id.in_(game_ids),
        GameMove.time_spent_ms.isnot(None),
        GameMove.time_spent_ms > 0,
    )
    result = db.execute(stmt).one()
    avg_time = result[0]
    count = result[1] or 0

    if count < 10 or avg_time is None:
        return 50

    # Heuristic: reasonable average time is 5-15 seconds
    avg_time_sec = float(avg_time) / 1000
    if 5 <= avg_time_sec <= 15:
        return 75
    elif 3 <= avg_time_sec <= 25:
        return 55
    else:
        return 35


def _calc_theme_scores(db: Session, user_id: str) -> dict:
    """Calculate per-theme puzzle scores."""
    # Get all puzzle attempts with puzzle themes
    stmt = (
        select(PuzzleAttempt, Puzzle.themes)
        .join(Puzzle, PuzzleAttempt.puzzle_id == Puzzle.id)
        .where(PuzzleAttempt.user_id == user_id)
    )
    results = db.execute(stmt).all()

    theme_data: dict[str, dict] = {}
    for attempt, themes_str in results:
        if not themes_str:
            continue
        themes = [t.strip() for t in themes_str.split(",") if t.strip()]
        for theme in themes:
            if theme not in theme_data:
                theme_data[theme] = {"correct": 0, "total": 0}
            theme_data[theme]["total"] += 1
            if attempt.is_correct:
                theme_data[theme]["correct"] += 1

    # Calculate scores
    result = {}
    for theme, data in theme_data.items():
        total = data["total"]
        correct = data["correct"]
        score = int(correct / total * 100) if total > 0 else 0
        result[theme] = {"correct": correct, "total": total, "score": score}

    return result


def _generate_recommendations(
    db: Session,
    user_id: str,
    dimension_scores: dict[str, int],
    theme_scores: dict,
    weakest: list[str],
) -> None:
    """Generate recommendations based on weakness analysis.

    Clears old active recommendations and generates new ones.
    """
    # Clear old active recommendations
    old_recs = db.execute(
        select(WeaknessRecommendation).where(
            WeaknessRecommendation.user_id == user_id,
            WeaknessRecommendation.status == "active",
        )
    ).scalars().all()
    for rec in old_recs:
        db.delete(rec)
    db.flush()

    priority = 0
    for dim in weakest:
        score = dimension_scores.get(dim)
        if score is None:
            # It's a theme key
            theme_data = theme_scores.get(dim, {})
            score = theme_data.get("score", 50)

        recs = _get_recommendations_for_dimension(dim, score)
        for rec_data in recs:
            rec = WeaknessRecommendation(
                id=str(uuid.uuid4()),
                user_id=user_id,
                weakness_dimension=dim,
                recommendation_type=rec_data["type"],
                target_id=rec_data.get("target_id"),
                target_label=rec_data["label"],
                reason=rec_data.get("reason", ""),
                priority=priority,
                status="active",
            )
            db.add(rec)
            priority += 1

    db.flush()


def _get_recommendations_for_dimension(dim: str, score: int) -> list[dict]:
    """Generate recommendation entries for a weak dimension."""
    recs = []
    label = DIMENSION_LABELS.get(dim, THEME_LABELS.get(dim, dim))

    if dim == "opening":
        recs.append({
            "type": "course",
            "label": "学习开局原则课程",
            "reason": f"你的开局得分为{score}分，低于平均水平",
        })
    elif dim == "middlegame_tactics":
        recs.append({
            "type": "puzzle_theme",
            "target_id": "fork",
            "label": "战术组合专项练习",
            "reason": f"你的中局战术得分为{score}分，建议多做战术组合谜题",
        })
    elif dim == "middlegame_strategy":
        recs.append({
            "type": "practice_game",
            "target_id": "yunduoshifu",
            "label": "与云朵师父对弈——练习位置性下法",
            "reason": f"你的中局战略得分为{score}分，与位置型对手对弈能提升战略意识",
        })
    elif dim == "endgame":
        recs.append({
            "type": "puzzle_theme",
            "target_id": "endgame",
            "label": "残局专项练习",
            "reason": f"你的残局得分为{score}分，建议加强残局训练",
        })
    elif dim == "time_management":
        recs.append({
            "type": "training_plan",
            "label": "限时训练模板",
            "reason": f"你的时间管理得分为{score}分，建议练习限时对弈",
        })
    else:
        # Theme-specific recommendation
        theme_label = THEME_LABELS.get(dim, dim)
        recs.append({
            "type": "puzzle_theme",
            "target_id": dim,
            "label": f"{theme_label}专项练习",
            "reason": f"你在{theme_label}主题的正确率偏低（{score}%）",
        })

    return recs


def _get_dimension_score(profile: UserWeaknessProfile, dim: str) -> int:
    """Get score for a dimension from profile."""
    score_map = {
        "opening": profile.opening_score,
        "middlegame_tactics": profile.middlegame_tactics_score,
        "middlegame_strategy": profile.middlegame_strategy_score,
        "endgame": profile.endgame_score,
        "time_management": profile.time_management_score,
    }
    if dim in score_map:
        return score_map[dim]
    # Theme score
    theme_data = (profile.theme_scores or {}).get(dim, {})
    if isinstance(theme_data, dict):
        return theme_data.get("score", 50)
    return 50


def _get_suggestion_for_dimension(dim: str) -> str:
    """Get a brief suggestion text for a dimension."""
    suggestions = {
        "opening": "试试学习开局原则课程吧",
        "middlegame_tactics": "多做一些战术组合谜题吧",
        "middlegame_strategy": "和云朵师父下几盘棋提升战略意识吧",
        "endgame": "来做几道残局专项练习吧",
        "time_management": "试试限时对弈模式吧",
    }
    if dim in suggestions:
        return suggestions[dim]
    theme_label = THEME_LABELS.get(dim, dim)
    return f"试试做几道{theme_label}专题谜题吧"
