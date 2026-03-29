"""对局复盘分析 Prompt 模板。"""

from app.ai.prompts.base import PromptTemplate


class ReviewPrompt(PromptTemplate):
    """对局复盘 Prompt。

    模板变量:
        rank_display: 用户段位展示文本，如 "10级"
        age_group: 年龄段，如 "少儿" / "成人"
        pgn: 对局 PGN 字符串
        user_color: 用户执子颜色 "white"（白方）/ "black"（黑方）
        character_name: AI角色名称，如 "小白兔"
        ai_rating: AI Rating 数值，如 800
        result: 对局结果，如 "白方胜" / "黑方胜" / "和棋"
    """

    system_prompt: str = (
        "你是一位友好的国际象棋教练，正在为一位{rank_display}水平的{age_group}学生分析棋局。\n"
        "你的分析要求：\n"
        "1. 从PGN棋谱中找出最多3个关键步骤（好棋、失误或转折点）\n"
        "2. 用简洁、鼓励的语言解释每个关键步骤，让{age_group}能理解\n"
        "3. 给出一句话总结和针对{rank_display}水平的改进建议\n"
        "4. 评估用户的走棋准确度（0.0~1.0之间的小数）\n"
        "5. 语言风格：简洁明了，多用鼓励性表达\n"
        "6. 必须严格输出合法的JSON格式，不要包含任何其他内容"
    )

    user_prompt: str = (
        "对局信息:\n"
        "- PGN棋谱: {pgn}\n"
        "- 用户执棋方: {user_color}（{'白方' if '{user_color}' == 'white' else '黑方'}）\n"
        "- 对手: {character_name}（AI，Rating {ai_rating}）\n"
        "- 对局结果: {result}\n"
        "- 用户段位: {rank_display}\n"
        "\n"
        "请分析这盘棋，找出关键步骤并给出总结。\n"
        "\n"
        "必须严格按照以下JSON格式输出，不要加任何其他文字:\n"
        "{{\n"
        '  "key_moments": [\n'
        "    {{\n"
        '      "move_number": <回合数>,\n'
        '      "side": "<white或black>",\n'
        '      "move_san": "<代数记谱法走法>",\n'
        '      "type": "<good_move|inaccuracy|blunder|checkmate>",\n'
        '      "comment": "<简短教学评语，20字以内>"\n'
        "    }}\n"
        "  ],\n"
        '  "summary": "<一句话总结，含鼓励语气>",\n'
        '  "user_accuracy": <0.0到1.0之间的小数>\n'
        "}}"
    )

    def build_messages(self, **kwargs: object) -> list[dict]:
        """构建复盘分析的 messages 列表。

        特殊处理：将 user_color 转换为中文显示。
        """
        user_color = str(kwargs.get("user_color", "white"))
        user_color_cn = "白方" if user_color == "white" else "黑方"

        system = self.system_prompt.format(**kwargs)

        # 手动构建 user prompt 避免 format 中嵌套 if 表达式问题
        user = (
            "对局信息:\n"
            f"- PGN棋谱: {kwargs.get('pgn', '')}\n"
            f"- 用户执棋方: {user_color}（{user_color_cn}）\n"
            f"- 对手: {kwargs.get('character_name', 'AI对手')}（AI，Rating {kwargs.get('ai_rating', 800)}）\n"
            f"- 对局结果: {kwargs.get('result', '')}\n"
            f"- 用户段位: {kwargs.get('rank_display', '初学者')}\n"
            "\n"
            "请分析这盘棋，找出关键步骤并给出总结。\n"
            "\n"
            "必须严格按照以下JSON格式输出，不要加任何其他文字:\n"
            "{\n"
            '  "key_moments": [\n'
            "    {\n"
            '      "move_number": <回合数>,\n'
            '      "side": "<white或black>",\n'
            '      "move_san": "<代数记谱法走法>",\n'
            '      "type": "<good_move|inaccuracy|blunder|checkmate>",\n'
            '      "comment": "<简短教学评语，20字以内>"\n'
            "    }\n"
            "  ],\n"
            '  "summary": "<一句话总结，含鼓励语气>",\n'
            '  "user_accuracy": <0.0到1.0之间的小数>\n'
            "}"
        )

        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
