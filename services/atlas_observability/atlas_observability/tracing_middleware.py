import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .shared import get_correlation_id

trace_id_ctx: ContextVar[str] = ContextVar("trace_id", default="")


def get_trace_id() -> str:
    return trace_id_ctx.get()


class AtlasTracingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        trace_id = request.headers.get("X-Trace-Id", str(uuid.uuid4()))
        trace_id_ctx.set(trace_id)
        correlation_id = get_correlation_id()

        response = await call_next(request)
        response.headers["X-Trace-Id"] = trace_id
        return response
