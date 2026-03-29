"""水平评估结果分析 Prompt 模板。"""

from app.ai.prompts.base import PromptTemplate


class AssessmentPrompt(PromptTemplate):
    """水平评估结果分析 Prompt。

    模板变量:
        correct_count: 答对题数
        total_count: 总题数
        accuracy: 正确率百分比，如 "75%"
        estimated_rating: 根据正确率估算的 Rating
        wrong_themes: 答错的题目涉及的战术主题列表，如 "fork, pin, discovered_attack"
        correct_themes: 答对的题目涉及的战术主题列表
    """

    system_prompt: str = (
        "你是一位国际象棋教育专家，正在为一位刚完成水平评估的学生生成分析报告。\n"
        "要求：\n"
        "1. 根据答题数据给出客观、鼓励性的评价\n"
        "2. 指出学生的强项（答对的主题）和薄弱环节（答错的主题）\n"
        "3. 给出2-3条具体的学习建议\n"
        "4. 语言友好、鼓励为主\n"
        "5. 必须严格输出合法的JSON格式，不要包含任何其他内容"
    )

    user_prompt: str = (
        "评估结果:\n"
        "- 答对: {correct_count}/{total_count}\n"
        "- 正确率: {accuracy}\n"
        "- 估算Rating: {estimated_rating}\n"
        "- 答对的主题: {correct_themes}\n"
        "- 答错的主题: {wrong_themes}\n"
        "\n"
        "请生成评估分析报告。\n"
        "\n"
        '输出JSON格式:\n'
        '{{\n'
        '  "rating": {estimated_rating},\n'
        '  "level_description": "对该水平的简短描述",\n'
        '  "strengths": ["强项1", "强项2"],\n'
        '  "weaknesses": ["薄弱点1", "薄弱点2"],\n'
        '  "suggestions": ["建议1", "建议2", "建议3"],\n'
        '  "summary": "一段鼓励性的总结文字"\n'
        '}}'
    )
