"""Slow-query logging and timing for Python services' SQLAlchemy engines.

Every Python service builds an engine with library defaults and nothing
watches how long statements actually take, so a full-table-scan filter
(hidden behind a WHERE clause) only shows up when tenants are already
slow. This helper installs the same two SQLAlchemy listeners on every
engine: it records statement durations into one histogram and logs any
statement that exceeds the threshold as a structured ``db.slow_query``
event with the statement text and parameter count (never parameter
values).

Thresholds: ``ATLAS_SLOW_QUERY_MS`` (default 500) is the documented
review threshold; anything above it is a candidate for the index audit
process described in ``docs/db-index-conventions.md``.
"""

import logging
import os
import time

from prometheus_client import Histogram
from sqlalchemy import event

logger = logging.getLogger(__name__)

DB_QUERY_DURATION = Histogram(
    "atlas_db_query_duration_seconds",
    "SQL statement duration by service",
    labelnames=["service"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)


def _threshold_seconds():
    try:
        value = float(os.environ.get("ATLAS_SLOW_QUERY_MS", "500"))
        if value < 0:
            raise ValueError("must be >= 0")
        return value / 1000.0
    except ValueError as e:
        logger.warning(
            "config.invalid_SLOW_QUERY_MS",
            extra={"fallback": 500, "error_type": type(e).__name__},
        )
        return 0.5


class _CursorTimer:
    """Per-cursor state carried between before/after listeners."""

    __slots__ = ("start", "statement", "param_count")

    def __init__(self, start, statement, param_count):
        self.start = start
        self.statement = statement
        self.param_count = param_count


def install_slow_query_listener(engine, service_name):
    """Attach before/after cursor listeners to ``engine``.

    Idempotent per engine object: calling it twice would double-instrument,
    which callers avoid by constructing engines once at import time.
    """
    threshold = _threshold_seconds()

    @event.listens_for(engine, "before_cursor_execute")
    def _before(conn, cursor, statement, parameters, context, executemany):
        context._atlas_timer = _CursorTimer(time.monotonic(), statement, len(parameters) if parameters else 0)

    @event.listens_for(engine, "after_cursor_execute")
    def _after(conn, cursor, statement, parameters, context, executemany):
        timer = getattr(context, "_atlas_timer", None)
        if timer is None:
            return
        elapsed = time.monotonic() - timer.start
        DB_QUERY_DURATION.labels(service=service_name).observe(elapsed)
        if elapsed >= threshold:
            logger.warning(
                "db.slow_query",
                extra={
                    "service": service_name,
                    "duration_ms": round(elapsed * 1000.0, 1),
                    "threshold_ms": threshold * 1000.0,
                    "param_count": timer.param_count,
                    "statement": " ".join(str(statement).split())[:1000],
                },
            )

    @event.listens_for(engine, "handle_error")
    def _on_error(exception_context):
        timer = getattr(exception_context.execution_context, "_atlas_timer", None) if exception_context.execution_context else None
        if timer is not None:
            elapsed = time.monotonic() - timer.start
            logger.warning(
                "db.failed_query",
                extra={
                    "service": service_name,
                    "duration_ms": round(elapsed * 1000.0, 1),
                    "param_count": timer.param_count,
                    "statement": " ".join(str(timer.statement).split())[:1000],
                },
            )
