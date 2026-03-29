"""Simple in-memory rate limiting middleware.

Uses a per-IP sliding-window counter stored in a plain dict.
Not suitable for multi-process deployments (use Redis-backed limiter instead).
"""

import time
from collections import defaultdict
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

# Paths that should have a stricter rate limit (e.g. auth endpoints)
_AUTH_PATHS = frozenset({
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
})


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window rate limiter.

    Args:
        app: ASGI application.
        default_rpm: Max requests per minute for normal endpoints (default 100).
        auth_rpm: Max requests per minute for auth endpoints (default 10).
    """

    def __init__(self, app, default_rpm: int = 100, auth_rpm: int = 10):
        super().__init__(app)
        self.default_rpm = default_rpm
        self.auth_rpm = auth_rpm
        # {ip: [timestamp, ...]}
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._last_cleanup = time.time()

    async def dispatch(self, request: Request, call_next: Callable):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = 60.0  # 1 minute

        # Periodic cleanup: remove stale entries every 5 minutes
        if now - self._last_cleanup > 300:
            self._cleanup(now, window)
            self._last_cleanup = now

        path = request.url.path
        is_auth = path in _AUTH_PATHS
        limit = self.auth_rpm if is_auth else self.default_rpm

        key = f"{client_ip}:{path}" if is_auth else client_ip

        # Prune old timestamps for this key
        timestamps = self._hits[key]
        cutoff = now - window
        # Remove entries older than the window
        while timestamps and timestamps[0] < cutoff:
            timestamps.pop(0)

        if len(timestamps) >= limit:
            retry_after = int(timestamps[0] + window - now) + 1
            return JSONResponse(
                status_code=429,
                content={
                    "code": 429,
                    "message": "Too many requests. Please try again later.",
                    "data": None,
                },
                headers={"Retry-After": str(retry_after)},
            )

        timestamps.append(now)
        response = await call_next(request)
        return response

    def _cleanup(self, now: float, window: float) -> None:
        """Remove keys whose timestamps are all expired."""
        cutoff = now - window
        stale_keys = [
            k for k, ts in self._hits.items()
            if not ts or ts[-1] < cutoff
        ]
        for k in stale_keys:
            del self._hits[k]
