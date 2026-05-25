import json
import logging
import time
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .shared import get_correlation_id


def configure_logging(service_name: str, level: int = logging.INFO) -> None:
    logger = logging.getLogger(service_name)
    logger.setLevel(level)
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.handlers.clear()
    logger.addHandler(handler)


def get_logger(service_name: str) -> logging.Logger:
    logger = logging.getLogger(service_name)
    if not logger.handlers:
        configure_logging(service_name)
    return logger


def log_event(logger: logging.Logger, event_type: str, **kwargs: Any) -> None:
    record = {
        "event": event_type,
    }
    record.update(kwargs)
    logger.info(json.dumps(record))


SENSITIVE_HEADERS = {"authorization", "cookie", "x-internal-key", "set-cookie"}


class AtlasLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.monotonic()
        correlation_id = get_correlation_id()
        user_id = request.headers.get("X-User-Id", "")
        tenant_id = request.headers.get("X-Tenant-Id", "")

        response = await call_next(request)

        duration_ms = (time.monotonic() - start_time) * 1000

        logger = get_logger("atlas")
        log_event(
            logger,
            "http.request",
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()),
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2),
            correlation_id=correlation_id,
            user_id=user_id,
            tenant_id=tenant_id,
        )
        return response
