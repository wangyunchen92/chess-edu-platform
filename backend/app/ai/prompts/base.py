"""Base prompt template class."""

from abc import ABC, abstractmethod


class PromptTemplate(ABC):
    """Prompt模板基类。

    子类需定义 ``system_prompt`` 和 ``user_prompt`` 类属性（使用 ``{variable}`` 占位符），
    并可选重写 ``build_messages`` 方法以实现更复杂的逻辑。
    """

    system_prompt: str = ""
    user_prompt: str = ""

    def build_messages(self, **kwargs: object) -> list[dict]:
        """构建完整的 OpenAI Chat messages 列表。

        Args:
            **kwargs: 模板变量，会被 ``str.format()`` 填充到 system_prompt 和 user_prompt 中。

        Returns:
            ``[{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]``
        """
        return [
            {"role": "system", "content": self.system_prompt.format(**kwargs)},
            {"role": "user", "content": self.user_prompt.format(**kwargs)},
        ]
