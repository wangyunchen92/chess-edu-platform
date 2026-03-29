"""谜题讲解 Prompt 模板。"""

from app.ai.prompts.base import PromptTemplate


class PuzzleExplainPrompt(PromptTemplate):
    """谜题讲解 Prompt。

    模板变量:
        rank_display: 用户段位展示文本，如 "10级"
        fen: 谜题局面 FEN 字符串
        solution_moves: 正确走法序列字符串，如 "Nf7+ Kg8 Nh6#"
        themes: 战术主题字符串，如 "fork, pin"
        user_moves: 用户实际走法字符串，如 "Nd6 Kg8"，未作答时为"（未作答）"
        is_correct: 用户是否正确 "是" / "否"
    """

    system_prompt: str = (
        "你是一位国际象棋教练，正在为一位{rank_display}水平的学生讲解战术谜题。\n"
        "讲解要求：\n"
        "1. 先指出这道题的战术主题是什么（用中文解释战术名称含义）\n"
        "2. 逐步解释正确走法的思路，说明每步棋的目的\n"
        "3. 如果用户走错了，友好地指出错误原因，并鼓励学生\n"
        "4. 如果用户走对了，给予鼓励并加深理解\n"
        "5. 语言简洁易懂，适合{rank_display}水平，回答控制在200字以内\n"
        "6. 不要重复FEN字符串，直接描述棋局局面"
    )

    user_prompt: str = (
        "谜题信息:\n"
        "- 局面FEN: {fen}\n"
        "- 正确走法序列: {solution_moves}\n"
        "- 战术主题: {themes}\n"
        "- 用户的走法: {user_moves}\n"
        "- 用户是否答对: {is_correct}\n"
        "\n"
        "请用教学性的语言讲解这道谜题的解题思路。"
        "如果用户走错了，请解释错误原因并指出正确思路。"
        "如果用户走对了，请给予鼓励并解释为什么这步棋好。"
    )

    def build_messages(self, **kwargs: object) -> list[dict]:
        """构建谜题讲解的 messages 列表。

        支持传入 is_correct 为 bool 类型，自动转换为 "是"/"否"。
        """
        # 处理 is_correct 的类型兼容
        is_correct = kwargs.get("is_correct", False)
        if isinstance(is_correct, bool):
            kwargs = dict(kwargs, is_correct="是" if is_correct else "否")

        # 处理 solution_moves 为列表的情况
        solution_moves = kwargs.get("solution_moves", "")
        if isinstance(solution_moves, list):
            kwargs = dict(kwargs, solution_moves=" ".join(solution_moves))

        # 处理 themes 为列表的情况
        themes = kwargs.get("themes", "")
        if isinstance(themes, list):
            kwargs = dict(kwargs, themes="、".join(themes) if themes else "综合战术")

        # 处理 user_moves 为列表的情况
        user_moves = kwargs.get("user_moves", "")
        if isinstance(user_moves, list):
            kwargs = dict(
                kwargs,
                user_moves=" ".join(user_moves) if user_moves else "（未作答）",
            )

        return [
            {"role": "system", "content": self.system_prompt.format(**kwargs)},
            {"role": "user", "content": self.user_prompt.format(**kwargs)},
        ]
