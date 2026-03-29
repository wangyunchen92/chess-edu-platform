"""AI Engine: unified entry point for all AI-powered features with automatic fallback."""

import json
import logging
from typing import Any

from app.config import settings
from app.ai.llm_client import llm_client, LLMRequestError
from app.ai.fallback import AIFallback
from app.ai.review_engine import review_engine, ReviewEngine
from app.ai.puzzle_engine import puzzle_engine, PuzzleEngine
from app.ai.teaching_engine import teaching_engine, TeachingEngine
from app.ai.prompts.assessment import AssessmentPrompt

logger = logging.getLogger(__name__)


class AIEngine:
    """AI引擎：统一调用入口，自动降级。

    所有方法遵循相同模式:
    1. 委托给专用子引擎（ReviewEngine / PuzzleEngine）或直接构建 Prompt
    2. 调用 LLM（同步）
    3. 解析响应
    4. 失败时自动降级到模板/规则
    """

    def __init__(self) -> None:
        self._review_engine: ReviewEngine = review_engine
        self._puzzle_engine: PuzzleEngine = puzzle_engine
        self._teaching_engine: TeachingEngine = teaching_engine

    # ------------------------------------------------------------------
    # 对局复盘
    # ------------------------------------------------------------------

    def generate_review(
        self,
        pgn: str,
        user_color: str,
        result: str,
        rank_display: str,
        character_name: str = "AI对手",
        ai_rating: int = 800,
        age_group: str = "少儿",
    ) -> dict[str, Any]:
        """生成对局复盘分析。

        Args:
            pgn: 完整的 PGN 字符串。
            user_color: 用户执子 "white" / "black"。
            result: 对局结果描述。
            rank_display: 用户段位展示文本。
            character_name: AI角色名称。
            ai_rating: AI Rating 值。
            age_group: 年龄段。

        Returns:
            复盘数据字典，包含 key_moments / summary / user_accuracy / is_fallback。
        """
        return self._review_engine.generate_review(
            pgn=pgn,
            user_color=user_color,
            result=result,
            character_name=character_name,
            ai_rating=ai_rating,
            rank_display=rank_display,
            age_group=age_group,
        )

    # ------------------------------------------------------------------
    # 谜题讲解
    # ------------------------------------------------------------------

    def explain_puzzle(
        self,
        fen: str,
        solution_moves: list[str],
        themes: list[str],
        description: str,
        user_moves: list[str],
        is_correct: bool,
        rank_display: str = "初学者",
    ) -> str:
        """生成谜题讲解文本。

        Args:
            fen: 谜题局面 FEN。
            solution_moves: 正确走法列表。
            themes: 战术主题列表。
            description: 谜题描述（传递给 PuzzleEngine，但当前 Prompt 不使用该字段）。
            user_moves: 用户实际走法列表。
            is_correct: 用户是否正确。
            rank_display: 用户段位展示文本。

        Returns:
            讲解文本字符串。
        """
        return self._puzzle_engine.explain_puzzle(
            fen=fen,
            solution=solution_moves,
            themes=themes,
            user_moves=user_moves,
            is_correct=is_correct,
            rank_display=rank_display,
        )

    # ------------------------------------------------------------------
    # AI互动教学
    # ------------------------------------------------------------------

    def teach_interactive(
        self,
        lesson_title: str,
        step_index: int,
        total_steps: int,
        current_fen: str,
        message: str,
        rank_display: str,
        age_group: str = "少儿",
    ) -> str:
        """AI互动教学对话。

        Args:
            lesson_title: 课程标题。
            step_index: 当前步骤序号。
            total_steps: 总步骤数。
            current_fen: 当前棋盘 FEN（可为空字符串）。
            message: 学生的提问。
            rank_display: 用户段位展示文本。
            age_group: 年龄段。

        Returns:
            AI助教的回复文本。
        """
        return self._teaching_engine.teach_interactive(
            lesson_title=lesson_title,
            step_index=step_index,
            total_steps=total_steps,
            current_fen=current_fen,
            user_message=message,
            rank_display=rank_display,
            age_group=age_group,
        )

    # ------------------------------------------------------------------
    # 水平评估
    # ------------------------------------------------------------------

    def assess_result(
        self,
        answers: list[dict[str, Any]],
        correct_count: int,
        total_count: int,
    ) -> dict[str, Any]:
        """生成水平评估报告。

        Args:
            answers: 答题详情列表，每项包含 question_id, is_correct, theme 等。
            correct_count: 答对题数。
            total_count: 总题数。

        Returns:
            评估报告字典，包含 rating / level_description / suggestions 等。
        """
        try:
            accuracy = correct_count / total_count if total_count > 0 else 0.0
            estimated_rating = int(300 + accuracy * 700)

            # 分析答对/答错的主题
            correct_themes: list[str] = []
            wrong_themes: list[str] = []
            for ans in answers:
                theme = ans.get("theme", "unknown")
                if ans.get("is_correct"):
                    if theme not in correct_themes:
                        correct_themes.append(theme)
                else:
                    if theme not in wrong_themes:
                        wrong_themes.append(theme)

            prompt = AssessmentPrompt()
            messages = prompt.build_messages(
                correct_count=correct_count,
                total_count=total_count,
                accuracy=f"{accuracy:.0%}",
                estimated_rating=estimated_rating,
                correct_themes=", ".join(correct_themes) if correct_themes else "无",
                wrong_themes=", ".join(wrong_themes) if wrong_themes else "无",
            )
            response = llm_client.chat_completion(
                messages,
                model=settings.LLM_MODEL_SIMPLE,
                max_tokens=400,
                temperature=0.5,
                response_format={"type": "json_object"},
            )
            data = json.loads(response)
            data["is_fallback"] = False
            logger.info("评估报告生成成功: %d/%d", correct_count, total_count)
            return data

        except (LLMRequestError, json.JSONDecodeError, KeyError) as exc:
            logger.warning("LLM评估生成失败，降级到模板: %s", exc)
            return AIFallback.assessment_fallback(correct_count, total_count)

        except Exception as exc:
            logger.error("评估生成意外错误，降级到模板: %s", exc, exc_info=True)
            return AIFallback.assessment_fallback(correct_count, total_count)


# ------------------------------------------------------------------
# 单例
# ------------------------------------------------------------------
ai_engine = AIEngine()
