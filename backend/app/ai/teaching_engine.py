"""AI互动教学引擎：调用 LLM 生成教学对话回复，失败时降级到模板。"""

import logging

from app.config import settings
from app.ai.llm_client import llm_client, LLMRequestError
from app.ai.prompts.teaching import TeachingPrompt
from app.ai.fallback import AIFallback

logger = logging.getLogger(__name__)


class TeachingEngine:
    """AI互动教学引擎。

    职责：
    - 构建教学对话 Prompt（基于课程上下文、棋盘局面、学生提问）
    - 调用 LLM（同步）生成教学性回复
    - LLM 失败时降级到模板回复
    """

    def teach_interactive(
        self,
        lesson_title: str,
        step_index: int,
        total_steps: int,
        current_fen: str,
        user_message: str,
        rank_display: str,
        age_group: str = "少儿",
    ) -> str:
        """AI互动教学对话。

        根据当前课程上下文和学生的提问，生成一段教学性的回复。
        回复风格会根据 age_group 和 rank_display 进行适配。

        Args:
            lesson_title: 课程标题，如 "棋子的分数——谁更值钱？"。
            step_index: 当前步骤序号（从1开始）。
            total_steps: 该课程总步骤数。
            current_fen: 当前棋盘 FEN 字符串（可为空字符串表示无棋盘）。
            user_message: 学生的提问内容。
            rank_display: 用户段位展示文本，如 "10级"、"初学者"。
            age_group: 年龄段，如 "少儿"、"成人"。

        Returns:
            AI助教的回复文本字符串。LLM 失败时返回降级模板文本。
        """
        try:
            prompt = TeachingPrompt()
            messages = prompt.build_messages(
                lesson_title=lesson_title,
                step_index=step_index,
                total_steps=total_steps,
                current_fen=current_fen or "无",
                message=user_message,
                rank_display=rank_display,
                age_group=age_group,
            )
            response = llm_client.chat_completion(
                messages,
                model=settings.LLM_MODEL_REVIEW,
                max_tokens=250,
                temperature=0.7,
            )
            logger.info(
                "教学对话生成成功: lesson=%s, step=%d/%d",
                lesson_title,
                step_index,
                total_steps,
            )
            return response.strip()

        except (LLMRequestError,) as exc:
            logger.warning("LLM教学对话失败，降级到模板: %s", exc)
            return self._fallback_response(lesson_title, step_index, total_steps)

        except Exception as exc:
            logger.error("教学对话意外错误，降级到模板: %s", exc, exc_info=True)
            return self._fallback_response(lesson_title, step_index, total_steps)

    def _fallback_response(
        self,
        lesson_title: str,
        step_index: int,
        total_steps: int,
    ) -> str:
        """LLM 不可用时的降级教学回复。

        返回鼓励性的模板文本，引导学生继续课程。
        """
        logger.info(
            "教学对话降级: lesson=%s, step=%d/%d",
            lesson_title,
            step_index,
            total_steps,
        )

        # 根据课程进度给出不同的鼓励文字
        if step_index <= 1:
            progress_hint = "你刚开始这节课，加油！"
        elif step_index >= total_steps:
            progress_hint = "你快要完成这节课了，坚持一下！"
        else:
            progress_hint = f"你已经完成了 {step_index}/{total_steps} 步，继续保持！"

        return (
            f"AI助教正在休息中。{progress_hint}\n"
            f"请继续阅读《{lesson_title}》的课件内容，稍后再试。\n"
            "如果遇到不懂的地方，可以先把问题记下来，等AI助教恢复后再提问。"
        )


# ------------------------------------------------------------------
# 单例实例
# ------------------------------------------------------------------
teaching_engine = TeachingEngine()
