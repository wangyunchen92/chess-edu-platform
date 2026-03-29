"""LLM API client wrapper for Volcengine (OpenAI-compatible format).

同步版本：使用 httpx 同步客户端，与后端同步服务层兼容。
"""

import json
import logging
import time
from typing import Iterator

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class LLMClient:
    """大模型API客户端（火山引擎，兼容OpenAI Chat Completions格式）。

    Features:
        - 同步 httpx 客户端，兼容 FastAPI 同步路由和服务层
        - 3次指数退避重试 (1s, 2s, 4s)
        - 30s 超时
        - 详细日志（请求模型、token用量）
        - 完善的错误处理
    """

    # 可重试的 HTTP 状态码
    _RETRYABLE_STATUS_CODES: set[int] = {429, 500, 502, 503, 504}
    _MAX_RETRIES: int = 3
    _BASE_RETRY_DELAY: float = 1.0  # 首次重试延迟（秒）

    def __init__(self) -> None:
        self.api_key: str = settings.LLM_API_KEY
        self.base_url: str = settings.LLM_API_BASE_URL.rstrip("/")
        self.client: httpx.Client = httpx.Client(
            timeout=httpx.Timeout(30.0, connect=10.0),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def chat_completion(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
        response_format: dict | None = None,
    ) -> str:
        """发送 Chat Completion 请求，返回助手回复文本。

        Args:
            messages: OpenAI 格式的 messages 列表。
            model: 模型名称，为 None 时使用默认 review 模型。
            temperature: 采样温度。
            max_tokens: 最大生成 token 数。
            response_format: 可选的响应格式约束，如 ``{"type": "json_object"}``。

        Returns:
            助手回复的纯文本内容。

        Raises:
            LLMRequestError: 当重试耗尽仍失败时抛出。
        """
        used_model = model or settings.LLM_MODEL_REVIEW
        payload: dict = {
            "model": used_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format is not None:
            payload["response_format"] = response_format

        logger.info(
            "LLM请求: model=%s, messages_count=%d, max_tokens=%d",
            used_model,
            len(messages),
            max_tokens,
        )

        data = self._request_with_retry(payload)

        # 解析响应
        content: str = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        logger.info(
            "LLM响应: model=%s, prompt_tokens=%s, completion_tokens=%s, total_tokens=%s",
            used_model,
            usage.get("prompt_tokens", "N/A"),
            usage.get("completion_tokens", "N/A"),
            usage.get("total_tokens", "N/A"),
        )
        return content

    def chat_completion_stream(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
    ) -> Iterator[str]:
        """流式返回 Chat Completion 响应。

        Yields:
            每个 SSE chunk 中的文本增量。
        """
        used_model = model or settings.LLM_MODEL_REVIEW
        payload: dict = {
            "model": used_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        url = f"{self.base_url}/chat/completions"
        logger.info("LLM流式请求: model=%s, messages_count=%d", used_model, len(messages))

        last_error: Exception | None = None
        for attempt in range(self._MAX_RETRIES):
            try:
                with self.client.stream("POST", url, json=payload) as resp:
                    if resp.status_code != 200:
                        body = resp.read()
                        error_msg = (
                            f"LLM流式API错误: status={resp.status_code}, "
                            f"body={body.decode(errors='replace')}"
                        )
                        if (
                            resp.status_code in self._RETRYABLE_STATUS_CODES
                            and attempt < self._MAX_RETRIES - 1
                        ):
                            delay = self._BASE_RETRY_DELAY * (2**attempt)
                            logger.warning(
                                "%s — 第%d次重试，%0.1fs后重试", error_msg, attempt + 1, delay
                            )
                            time.sleep(delay)
                            continue
                        raise LLMRequestError(error_msg)

                    for line in resp.iter_lines():
                        line = line.strip()
                        if not line or not line.startswith("data:"):
                            continue
                        data_str = line[len("data:"):].strip()
                        if data_str == "[DONE]":
                            return
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk["choices"][0].get("delta", {})
                            text = delta.get("content", "")
                            if text:
                                yield text
                        except (json.JSONDecodeError, KeyError, IndexError) as exc:
                            logger.debug("解析流式chunk失败: %s, raw=%s", exc, data_str)
                    return  # 正常结束

            except httpx.TimeoutException as exc:
                last_error = exc
                if attempt < self._MAX_RETRIES - 1:
                    delay = self._BASE_RETRY_DELAY * (2**attempt)
                    logger.warning(
                        "LLM流式请求超时(attempt %d/%d)，%0.1fs后重试",
                        attempt + 1,
                        self._MAX_RETRIES,
                        delay,
                    )
                    time.sleep(delay)
                else:
                    raise LLMRequestError(
                        f"LLM流式请求超时，已重试{self._MAX_RETRIES}次: {exc}"
                    ) from exc

            except httpx.HTTPError as exc:
                last_error = exc
                if attempt < self._MAX_RETRIES - 1:
                    delay = self._BASE_RETRY_DELAY * (2**attempt)
                    logger.warning(
                        "LLM流式网络错误(attempt %d/%d): %s，%0.1fs后重试",
                        attempt + 1,
                        self._MAX_RETRIES,
                        exc,
                        delay,
                    )
                    time.sleep(delay)
                else:
                    raise LLMRequestError(
                        f"LLM流式网络错误，已重试{self._MAX_RETRIES}次: {exc}"
                    ) from exc

        # 理论上不应到达此处
        raise LLMRequestError(f"LLM流式请求失败: {last_error}")

    def close(self) -> None:
        """关闭底层 HTTP 客户端。"""
        self.client.close()
        logger.info("LLMClient已关闭")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _request_with_retry(self, payload: dict) -> dict:
        """带指数退避重试的请求。

        Retry schedule: 1s, 2s, 4s (共3次)。

        Returns:
            解析后的 JSON 响应体。
        """
        url = f"{self.base_url}/chat/completions"
        last_error: Exception | None = None

        for attempt in range(self._MAX_RETRIES):
            try:
                resp = self.client.post(url, json=payload)

                if resp.status_code == 200:
                    return resp.json()

                error_body = resp.text
                error_msg = f"LLM API错误: status={resp.status_code}, body={error_body}"

                if (
                    resp.status_code in self._RETRYABLE_STATUS_CODES
                    and attempt < self._MAX_RETRIES - 1
                ):
                    delay = self._BASE_RETRY_DELAY * (2**attempt)
                    logger.warning("%s — 第%d次重试，%0.1fs后重试", error_msg, attempt + 1, delay)
                    time.sleep(delay)
                    continue

                # 不可重试的错误码，直接抛出
                raise LLMRequestError(error_msg)

            except httpx.TimeoutException as exc:
                last_error = exc
                if attempt < self._MAX_RETRIES - 1:
                    delay = self._BASE_RETRY_DELAY * (2**attempt)
                    logger.warning(
                        "LLM请求超时(attempt %d/%d)，%0.1fs后重试",
                        attempt + 1,
                        self._MAX_RETRIES,
                        delay,
                    )
                    time.sleep(delay)
                else:
                    raise LLMRequestError(
                        f"LLM请求超时，已重试{self._MAX_RETRIES}次: {exc}"
                    ) from exc

            except httpx.HTTPError as exc:
                last_error = exc
                if attempt < self._MAX_RETRIES - 1:
                    delay = self._BASE_RETRY_DELAY * (2**attempt)
                    logger.warning(
                        "LLM网络错误(attempt %d/%d): %s，%0.1fs后重试",
                        attempt + 1,
                        self._MAX_RETRIES,
                        exc,
                        delay,
                    )
                    time.sleep(delay)
                else:
                    raise LLMRequestError(
                        f"LLM网络错误，已重试{self._MAX_RETRIES}次: {exc}"
                    ) from exc

        # 理论上不应到达此处
        raise LLMRequestError(f"LLM请求失败: {last_error}")


class LLMRequestError(Exception):
    """LLM 请求失败异常。"""


# ------------------------------------------------------------------
# 单例实例
# ------------------------------------------------------------------
llm_client = LLMClient()
