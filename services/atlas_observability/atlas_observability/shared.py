import uuid
from contextvars import ContextVar
from dataclasses import dataclass, field

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")


@dataclass
class ObservabilityConfig:
    service_name: str = ""
    service_version: str = ""
    environment: str = "development"


def get_correlation_id() -> str:
    return correlation_id_ctx.get()


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-Id", str(uuid.uuid4()))
        correlation_id_ctx.set(correlation_id)
        response = await call_next(request)
        response.headers["X-Correlation-Id"] = correlation_id
        return response
