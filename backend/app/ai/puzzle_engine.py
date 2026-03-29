"""谜题讲解引擎：调用 LLM 生成战术谜题教学讲解，失败时降级到模板。"""

import logging

from app.config import settings
from app.ai.llm_client import llm_client, LLMRequestError
from app.ai.prompts.puzzle_explain import PuzzleExplainPrompt

logger = logging.getLogger(__name__)

# 战术主题中文名称映射
_THEME_NAMES: dict[str, str] = {
    "fork": "捉双（Fork）",
    "pin": "牵制（Pin）",
    "skewer": "串击（Skewer）",
    "discovered_attack": "闪击（Discovered Attack）",
    "double_check": "双将（Double Check）",
    "mate_in_1": "一步杀",
    "mate_in_2": "两步杀",
    "mate_in_3": "三步杀",
    "back_rank_mate": "底线杀（Back Rank Mate）",
    "sacrifice": "弃子战术（Sacrifice）",
    "deflection": "引离（Deflection）",
    "attraction": "引入（Attraction）",
    "trapped_piece": "困子（Trapped Piece）",
    "zwischenzug": "中间手（Zwischenzug）",
    "clearance": "清道（Clearance）",
}

# 战术主题详细讲解（降级时使用）
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

_DEFAULT_EXPLANATION: str = (
    "这道题涉及一个重要的国际象棋战术。"
    "仔细观察棋盘，寻找能同时产生多个威胁的走法，"
    "或者能利用对方棋子位置弱点的走法。"
)


class PuzzleEngine:
    """谜题讲解引擎。

    职责：
    - 构建谜题讲解 Prompt
    - 调用 LLM（同步）生成教学性讲解文字
    - LLM 失败时降级到主题模板讲解
    """

    def explain_puzzle(
        self,
        fen: str,
        solution: list[str],
        themes: list[str],
        user_moves: list[str],
        is_correct: bool,
        rank_display: str,
    ) -> str:
        """生成谜题讲解文本。

        Args:
            fen: 谜题局面 FEN 字符串。
            solution: 正确解法走法列表，如 ["Nf7+", "Kg8", "Nh6#"]。
            themes: 战术主题列表，如 ["fork", "pin"]。
            user_moves: 用户实际走法列表，空列表表示未作答。
            is_correct: 用户是否答对。
            rank_display: 用户段位展示文本，如 "10级"。

        Returns:
            教学性的讲解文字字符串。LLM 失败时返回基于主题的模板讲解。
        """
        try:
            prompt = PuzzleExplainPrompt()
            messages = prompt.build_messages(
                fen=fen,
                solution_moves=solution,
                themes=themes,
                user_moves=user_moves,
                is_correct=is_correct,
                rank_display=rank_display,
            )
            response = llm_client.chat_completion(
                messages,
                model=settings.LLM_MODEL_SIMPLE,
                max_tokens=350,
                temperature=0.6,
            )
            logger.info(
                "谜题讲解生成成功: fen=%.20s, themes=%s, correct=%s",
                fen,
                themes,
                is_correct,
            )
            return response.strip()

        except (LLMRequestError,) as exc:
            logger.warning("LLM谜题讲解失败，降级到模板: %s", exc)
            return self._fallback_explain(solution, themes, is_correct)

        except Exception as exc:
            logger.error("谜题讲解意外错误，降级到模板: %s", exc, exc_info=True)
            return self._fallback_explain(solution, themes, is_correct)

    def _fallback_explain(
        self,
        solution: list[str],
        themes: list[str],
        is_correct: bool,
    ) -> str:
        """LLM 不可用时的降级讲解，基于战术主题返回通用讲解。"""
        logger.info("谜题讲解降级: themes=%s, solution_len=%d", themes, len(solution))

        parts: list[str] = []

        # 根据是否答对给出反馈
        if is_correct:
            parts.append("答对了！非常棒！\n\n")
        else:
            parts.append("别灰心，让我们一起来分析这道题。\n\n")

        # 根据主题生成讲解
        if themes:
            for theme in themes:
                explanation = _THEME_EXPLANATIONS.get(
                    theme.lower().strip(),
                    _DEFAULT_EXPLANATION,
                )
                parts.append(explanation)
        else:
            parts.append(_DEFAULT_EXPLANATION)

        # 附加正确走法
        if solution:
            moves_str = " ".join(solution)
            parts.append(f"\n\n正确走法是: {moves_str}。试着理解每一步的用意，然后再做一遍加深印象。")

        return "\n\n".join(parts)


# ------------------------------------------------------------------
# 单例实例
# ------------------------------------------------------------------
puzzle_engine = PuzzleEngine()
