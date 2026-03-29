"""对局复盘引擎：调用 LLM 生成对局复盘分析，失败时降级到模板。"""

import json
import logging
import re
from typing import Any

from app.config import settings
from app.ai.llm_client import llm_client, LLMRequestError
from app.ai.prompts.review import ReviewPrompt

logger = logging.getLogger(__name__)


class ReviewEngine:
    """对局复盘引擎。

    职责：
    - 构建复盘 Prompt
    - 调用 LLM（同步）
    - 解析并校验 JSON 响应
    - LLM 失败时降级到规则模板
    """

    def generate_review(
        self,
        pgn: str,
        user_color: str,
        result: str,
        character_name: str,
        ai_rating: int,
        rank_display: str,
        age_group: str = "少儿",
    ) -> dict[str, Any]:
        """生成对局复盘分析。

        Args:
            pgn: 完整的 PGN 字符串。
            user_color: 用户执子 "white" / "black"。
            result: 对局结果描述，如 "白方胜" / "黑方胜" / "和棋"。
            character_name: AI角色名称，如 "小白兔"。
            ai_rating: AI Rating 数值。
            rank_display: 用户段位展示文本，如 "10级"。
            age_group: 年龄段，如 "少儿" / "成人"。

        Returns:
            复盘数据字典，包含::

                {
                    "key_moments": [...],
                    "summary": "...",
                    "user_accuracy": 0.xx,
                    "is_fallback": False
                }

            LLM 失败时 ``is_fallback=True``，key_moments 为空列表。
        """
        try:
            prompt = ReviewPrompt()
            messages = prompt.build_messages(
                pgn=pgn,
                user_color=user_color,
                result=result,
                rank_display=rank_display,
                character_name=character_name,
                ai_rating=ai_rating,
                age_group=age_group,
            )
            raw = llm_client.chat_completion(
                messages,
                model=settings.LLM_MODEL_REVIEW,
                max_tokens=600,
                temperature=0.5,
                response_format={"type": "json_object"},
            )
            data = self._parse_review_response(raw)
            data["is_fallback"] = False
            logger.info(
                "复盘生成成功: pgn_len=%d, key_moments=%d",
                len(pgn),
                len(data.get("key_moments", [])),
            )
            return data

        except (LLMRequestError, ValueError) as exc:
            logger.warning("LLM复盘生成失败，降级到模板: %s", exc)
            return self._fallback_review(pgn, user_color, result)

        except Exception as exc:
            logger.error("复盘生成意外错误，降级到模板: %s", exc, exc_info=True)
            return self._fallback_review(pgn, user_color, result)

    def _parse_review_response(self, raw: str) -> dict[str, Any]:
        """解析 LLM 返回的复盘 JSON 字符串。

        尝试顺序：
        1. 直接 json.loads
        2. 提取第一个 ``{...}`` 代码块再解析
        3. 抛出 ValueError

        Args:
            raw: LLM 原始输出文本。

        Returns:
            包含 key_moments / summary / user_accuracy 的字典。

        Raises:
            ValueError: 无法解析为合法 JSON 时抛出。
        """
        raw = raw.strip()

        # 尝试1：直接解析
        try:
            data = json.loads(raw)
            return self._normalize_review_data(data)
        except json.JSONDecodeError:
            pass

        # 尝试2：从文本中提取 JSON 块（LLM 有时会在 JSON 前后加说明文字）
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            try:
                data = json.loads(match.group())
                return self._normalize_review_data(data)
            except json.JSONDecodeError:
                pass

        raise ValueError(f"无法解析复盘JSON响应，原始内容前100字符: {raw[:100]}")

    def _normalize_review_data(self, data: dict) -> dict[str, Any]:
        """规整化复盘数据，补全缺失字段，保证结构完整。"""
        # 确保 key_moments 是列表
        key_moments = data.get("key_moments", [])
        if not isinstance(key_moments, list):
            key_moments = []

        # 校验每个 key_moment 的字段
        valid_moments = []
        for moment in key_moments:
            if not isinstance(moment, dict):
                continue
            valid_moments.append({
                "move_number": moment.get("move_number", 0),
                "side": moment.get("side", "white"),
                "move_san": moment.get("move_san", ""),
                "type": moment.get("type", "inaccuracy"),
                "comment": moment.get("comment", ""),
            })

        # 确保 user_accuracy 是合法数值
        accuracy = data.get("user_accuracy")
        if accuracy is not None:
            try:
                accuracy = float(accuracy)
                accuracy = max(0.0, min(1.0, accuracy))  # 限制在 [0, 1] 范围
            except (TypeError, ValueError):
                accuracy = None

        return {
            "key_moments": valid_moments,
            "summary": str(data.get("summary", "感谢你完成了这盘棋，继续努力！")),
            "user_accuracy": accuracy,
        }

    def _fallback_review(self, pgn: str, user_color: str, result: str) -> dict[str, Any]:
        """LLM 不可用时的降级复盘，基于规则生成简化分析。"""
        logger.info("复盘降级: pgn_len=%d, color=%s, result=%s", len(pgn), user_color, result)

        parts: list[str] = []
        result_lower = result.lower()

        if "1-0" in result or "白方胜" in result:
            if user_color == "white":
                parts.append("恭喜你赢得了这盘棋！")
            else:
                parts.append("这盘棋虽然输了，但每盘棋都是学习的机会。")
        elif "0-1" in result or "黑方胜" in result:
            if user_color == "black":
                parts.append("恭喜你赢得了这盘棋！")
            else:
                parts.append("这盘棋虽然输了，但每盘棋都是学习的机会。")
        elif "1/2" in result or "和棋" in result or "draw" in result_lower:
            parts.append("这盘棋下成了和棋，说明双方实力相当。")
        else:
            parts.append("感谢你完成了这盘棋。")

        parts.append("AI详细分析暂时不可用，请稍后重试查看完整复盘。你可以使用棋盘回放功能自行复盘。")

        return {
            "key_moments": [],
            "summary": "".join(parts),
            "user_accuracy": None,
            "is_fallback": True,
        }


# ------------------------------------------------------------------
# 单例实例
# ------------------------------------------------------------------
review_engine = ReviewEngine()
