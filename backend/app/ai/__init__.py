"""AI/LLM integration layer package.

Exports:
    llm_client: LLM API 客户端单例（同步）
    ai_engine: AI 引擎单例（统一调用入口，自动降级）
    review_engine: 复盘引擎单例
    puzzle_engine: 谜题讲解引擎单例
    teaching_engine: 教学引擎单例
    AIFallback: 降级策略类
    LLMRequestError: LLM 请求异常
"""

from app.ai.llm_client import llm_client, LLMRequestError
from app.ai.fallback import AIFallback
from app.ai.review_engine import review_engine, ReviewEngine
from app.ai.puzzle_engine import puzzle_engine, PuzzleEngine
from app.ai.teaching_engine import teaching_engine, TeachingEngine
from app.ai.engine import ai_engine, AIEngine

__all__ = [
    "llm_client",
    "ai_engine",
    "AIEngine",
    "review_engine",
    "ReviewEngine",
    "puzzle_engine",
    "PuzzleEngine",
    "teaching_engine",
    "TeachingEngine",
    "AIFallback",
    "LLMRequestError",
]
