"""Request logging middleware."""

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("chess_edu.access")


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs each request with method, path, duration, and status code."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        start_time = time.perf_counter()

        response = await call_next(request)

        duration_ms = (time.perf_counter() - start_time) * 1000
        status_code = response.status_code
        method = request.method
        path = request.url.path
        query = str(request.url.query)
        full_path = f"{path}?{query}" if query else path

        logger.info(
            "%s %s -> %d (%.1fms)",
            method,
            full_path,
            status_code,
            duration_ms,
        )

        # Add timing header for debugging
        response.headers["X-Process-Time-Ms"] = f"{duration_ms:.1f}"

        return response
