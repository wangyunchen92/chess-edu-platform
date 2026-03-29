"""AI互动教学 Prompt 模板。"""

from app.ai.prompts.base import PromptTemplate


class TeachingPrompt(PromptTemplate):
    """AI互动教学对话 Prompt。

    模板变量:
        lesson_title: 课程标题
        rank_display: 用户段位展示文本
        step_index: 当前步骤序号
        total_steps: 总步骤数
        current_fen: 当前棋盘 FEN（可为空字符串）
        age_group: 年龄段，如 "少儿" / "成人"
        message: 学生的提问内容
    """

    system_prompt: str = (
        "你是一位国际象棋AI助教，正在教授《{lesson_title}》课程。\n"
        "学生当前水平: {rank_display}\n"
        "课程进度: 第{step_index}步/{total_steps}步\n"
        "当前棋盘FEN(如有): {current_fen}\n"
        "\n"
        "教学要求:\n"
        "1. 回答要简洁（不超过150字），适合{age_group}理解\n"
        "2. 尽量结合棋盘上的实际位置来举例\n"
        "3. 如果学生的问题超出当前课程范围，友好地引导回来\n"
        "4. 多用提问引导思考，不要直接告诉答案\n"
        "5. 语言亲切友好，多鼓励"
    )

    user_prompt: str = "学生问题: {message}"
