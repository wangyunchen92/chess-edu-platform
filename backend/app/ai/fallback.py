"""AI降级策略：当 LLM 不可用时返回预写模板/规则计算结果。"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class AIFallback:
    """AI降级策略集合。

    所有方法返回的数据结构与正常 LLM 响应保持一致，
    在响应中通过 ``is_fallback=True`` 标记为降级结果。
    """

    # ------------------------------------------------------------------
    # 战术主题中文讲解映射
    # ------------------------------------------------------------------
    _THEME_EXPLANATIONS: dict[str, str] = {
        "fork": (
            "这道题考查的是**捉双**（Fork）战术。"
            "捉双是指用一个棋子同时攻击对方两个或更多棋子，"
            "迫使对方只能救其中一个，从而获得子力优势。"
            "常见的捉双棋子有骑士（马）和皇后。"
        ),
        "pin": (
            "这道题考查的是**牵制**（Pin）战术。"
            "牵制是指一个棋子攻击对方的某个棋子，而该棋子无法移动，"
            "因为移动后会暴露身后更重要的棋子（如国王或皇后）。"
            "牵制通常由主教（象）、车或皇后实施。"
        ),
        "skewer": (
            "这道题考查的是**串击**（Skewer）战术。"
            "串击与牵制相反，攻击方直接威胁价值更高的棋子，"
            "当高价值棋子被迫移开后，身后价值较低的棋子就会被吃掉。"
        ),
        "discovered_attack": (
            "这道题考查的是**闪击**（Discovered Attack）战术。"
            "当一个棋子移开后，露出身后棋子的攻击线，"
            "形成两个棋子同时发起攻击的局面。"
            "如果被闪露的攻击是将军，则称为「闪将」。"
        ),
        "double_check": (
            "这道题考查的是**双将**（Double Check）战术。"
            "双将是闪击的特殊形式，移动的棋子和被闪露的棋子同时将军。"
            "面对双将，对方只能移动国王，不能阻挡或吃子。"
        ),
        "mate_in_1": (
            "这道题是一步杀棋练习。"
            "关键是找到能直接将死对方国王的那步棋。"
            "注意观察对方国王的逃跑路线，确保所有出路都被封锁。"
        ),
        "mate_in_2": (
            "这道题是两步杀棋练习。"
            "需要先走一步迫使对方做出特定应对，然后再给出致命一击。"
            "思考时要考虑对方所有可能的回应。"
        ),
        "back_rank_mate": (
            "这道题考查的是**底线杀**（Back Rank Mate）。"
            "当国王被自己的兵困在底线、无法逃脱时，"
            "车或皇后冲到底线即可将杀。"
            "这提醒我们要注意给国王留出「气窗」。"
        ),
        "sacrifice": (
            "这道题涉及**弃子战术**（Sacrifice）。"
            "有时候主动牺牲一个棋子可以获得更大的回报，"
            "比如打开进攻通道、赢得更多子力或直接将杀。"
        ),
        "deflection": (
            "这道题考查的是**引离**（Deflection）战术。"
            "通过攻击对方的关键防守棋子，迫使它离开防守位置，"
            "从而在其他方向上取得突破。"
        ),
        "attraction": (
            "这道题考查的是**引入**（Attraction）战术。"
            "通过弃子等手段，将对方的棋子（尤其是国王）"
            "引诱到一个不利的位置，以便后续发起致命攻击。"
        ),
        "trapped_piece": (
            "这道题考查的是**困子**（Trapped Piece）。"
            "当对方的棋子移动到了一个危险位置，"
            "可以通过控制周围的格子让它无处可逃，从而赢得该子。"
        ),
    }

    _DEFAULT_THEME_EXPLANATION: str = (
        "这道题涉及一个重要的国际象棋战术。"
        "仔细观察棋盘，寻找能同时产生多个威胁的走法，"
        "或者能利用对方棋子位置弱点的走法。"
    )

    # ------------------------------------------------------------------
    # 降级方法（同步）
    # ------------------------------------------------------------------

    @staticmethod
    def review_fallback(pgn: str, user_color: str, result: str) -> dict[str, Any]:
        """复盘降级：返回基于规则的简化分析。

        Args:
            pgn: 对局 PGN 字符串。
            user_color: 用户执子颜色。
            result: 对局结果描述。

        Returns:
            与正常复盘相同结构的字典，``is_fallback=True``。
        """
        logger.info("复盘降级: pgn_len=%d, color=%s, result=%s", len(pgn), user_color, result)

        # 尝试从 PGN 中提取基本信息
        summary_parts: list[str] = []
        if "1-0" in result or "白方胜" in result:
            if user_color == "white":
                summary_parts.append("恭喜你赢得了这盘棋！")
            else:
                summary_parts.append("这盘棋虽然输了，但每盘棋都是学习的机会。")
        elif "0-1" in result or "黑方胜" in result:
            if user_color == "black":
                summary_parts.append("恭喜你赢得了这盘棋！")
            else:
                summary_parts.append("这盘棋虽然输了，但每盘棋都是学习的机会。")
        elif "1/2" in result or "和棋" in result:
            summary_parts.append("这盘棋下成了和棋，说明双方实力相当。")
        else:
            summary_parts.append("感谢你完成了这盘棋。")

        summary_parts.append("AI详细分析暂时不可用，请稍后重试查看完整复盘。您可以使用棋盘回放功能自行复盘。")

        return {
            "key_moments": [],
            "summary": "".join(summary_parts),
            "user_accuracy": None,
            "is_fallback": True,
        }

    @staticmethod
    def puzzle_explain_fallback(solution_moves: list[str], themes: list[str]) -> str:
        """谜题讲解降级：返回基于主题的通用讲解。

        Args:
            solution_moves: 正确走法列表。
            themes: 战术主题列表。

        Returns:
            拼接后的讲解文本。
        """
        logger.info("谜题讲解降级: themes=%s, solution_len=%d", themes, len(solution_moves))

        parts: list[str] = []

        # 根据主题生成讲解
        if themes:
            for theme in themes:
                explanation = AIFallback._THEME_EXPLANATIONS.get(
                    theme.lower().strip(),
                    AIFallback._DEFAULT_THEME_EXPLANATION,
                )
                parts.append(explanation)
        else:
            parts.append(AIFallback._DEFAULT_THEME_EXPLANATION)

        # 附加正确走法
        if solution_moves:
            moves_str = " ".join(solution_moves)
            parts.append(f"\n正确走法是: {moves_str}。试着理解每一步的用意，然后再做一遍加深印象。")

        return "\n\n".join(parts)

    @staticmethod
    def teaching_fallback(lesson_title: str) -> str:
        """教学对话降级。

        Args:
            lesson_title: 当前课程标题。

        Returns:
            降级提示文本。
        """
        logger.info("教学对话降级: lesson=%s", lesson_title)
        return (
            f"AI助教正在休息中，请继续阅读《{lesson_title}》的课件内容，稍后再试。\n"
            "如果遇到不懂的地方，可以先把问题记下来，等AI助教恢复后再提问。"
        )

    @staticmethod
    def assessment_fallback(correct_count: int, total_count: int) -> dict[str, Any]:
        """评估降级：基于正确率简单计算 Rating，不生成个性化建议。

        Args:
            correct_count: 答对题数。
            total_count: 总题数。

        Returns:
            与正常评估相同结构的字典，``is_fallback=True``。
        """
        logger.info("评估降级: correct=%d, total=%d", correct_count, total_count)

        accuracy = correct_count / total_count if total_count > 0 else 0.0

        # 简单的 Rating 估算公式：基础分300 + 正确率 * 700
        # 满分约1000，全错约300
        estimated_rating = int(300 + accuracy * 700)

        # 根据正确率给出不同档位的描述
        if accuracy >= 0.8:
            level_desc = "基础扎实"
            summary = "你的表现非常棒！基础知识掌握得很好，可以开始学习更高级的战术了。"
        elif accuracy >= 0.6:
            level_desc = "有一定基础"
            summary = "你已经有了不错的基础，继续加油！多做练习可以进步更快。"
        elif accuracy >= 0.4:
            level_desc = "入门阶段"
            summary = "你正在入门阶段，不要着急，国际象棋需要慢慢积累。建议从基础课程开始学起。"
        else:
            level_desc = "刚刚起步"
            summary = "欢迎来到国际象棋的世界！建议从最基础的棋子走法课程开始，一步步来。"

        return {
            "rating": estimated_rating,
            "level_description": level_desc,
            "strengths": [],
            "weaknesses": [],
            "suggestions": [
                "完成推荐的基础课程",
                "每天坚持做2-3道战术谜题",
                "多下棋实战，积累经验",
            ],
            "summary": summary,
            "is_fallback": True,
        }
