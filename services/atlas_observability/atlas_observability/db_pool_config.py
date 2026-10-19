"""Database pool sizing and statement-timeout configuration for services.

Runaway queries are the classic way an analytics endpoint takes a shared
Postgres down: nothing bounds how long a statement may run, pool waits
stack up behind it, and every request in every service shares the same
database. This helper gives each engine an explicit, reviewed pool
configuration and a Postgres ``statement_timeout`` instead of library
defaults, plus an exception handler so a saturated pool degrades fast
(503 + metric) instead of queueing silently.

Environment (all optional, shared defaults; a service may override with
``<PREFIX>_`` prefixed variants):

- ``DATABASE_STATEMENT_TIMEOUT_MS``   statement time budget (default 15000)
- ``DATABASE_POOL_SIZE``              steady-state connections (default 5)
- ``DATABASE_MAX_OVERFLOW``           burst connections (default 10)
- ``DATABASE_POOL_RECYCLE_SECONDS``   connection recycle (default 1800)
- ``DATABASE_POOL_TIMEOUT_SECONDS``   checkout wait before failing (default 10)
"""

import logging
import os

from prometheus_client import Counter
from sqlalchemy import exc as sa_exc

logger = logging.getLogger(__name__)

DEFAULTS = {
    "DATABASE_STATEMENT_TIMEOUT_MS": 15000,
    "DATABASE_POOL_SIZE": 5,
    "DATABASE_MAX_OVERFLOW": 10,
    "DATABASE_POOL_RECYCLE_SECONDS": 1800,
    "DATABASE_POOL_TIMEOUT_SECONDS": 10,
}

# Documented sizing rule: pool_size covers the service's steady concurrency
# (FastAPI threadpool workers that touch the DB, target <= 70% busy), and
# max_overflow is the burst above it. Fixed counts, not library defaults, so
# the Postgres connection budget per deployment is knowable and bounded:
# total = pool_size + max_overflow per process.

POOL_EXHAUSTED_TOTAL = Counter(
    "atlas_db_pool_exhausted_total",
    "Requests refused because the connection pool checkout timed out",
    labelnames=["service"],
)


def _int_env(name, prefix=None):
    """Read an integer env var, trying ``<PREFIX>_<name>`` first.

    Invalid values fall back to the documented default with a warning
    rather than breaking engine construction.
    """
    value = os.environ.get(name, "")
    if prefix:
        value = os.environ.get(f"{prefix}_{name}", value)
    if isinstance(value, str) and value == value.strip() and value and not value.lstrip("+-").isdigit():
        logger.warning(
            "config.invalid_db_pool_env",
            extra={"env": name, "fallback": DEFAULTS[name]},
        )
        return DEFAULTS[name]
    try:
        return int(value) if value else DEFAULTS[name]
    except (TypeError, ValueError):
        return DEFAULTS[name]


def engine_kwargs(database_url, prefix=None):
    """``create_engine`` kwargs implementing the documented pool policy.

    ``statement_timeout`` is applied through ``connect_args`` only for
    PostgreSQL URLs (SQLite used by unit harnesses must not receive PG
    connection options). ``pool_timeout`` bounds how long a checkout may
    wait on a saturated pool: the caller surfaces ``sqlalchemy.exc.TimeoutError``
    instead of an unbounded queue behind one slow tenant query.
    """
    prefix = (prefix or "").upper() or None
    statement_timeout_ms = _int_env("DATABASE_STATEMENT_TIMEOUT_MS", prefix)
    kwargs = {
        "pool_pre_ping": True,
        "pool_size": _int_env("DATABASE_POOL_SIZE", prefix),
        "max_overflow": _int_env("DATABASE_MAX_OVERFLOW", prefix),
        "pool_recycle": _int_env("DATABASE_POOL_RECYCLE_SECONDS", prefix),
        "pool_timeout": _int_env("DATABASE_POOL_TIMEOUT_SECONDS", prefix),
    }
    if database_url and str(database_url).strip().lower().startswith("postgresql"):
        kwargs["connect_args"] = {
            "options": f"-c statement_timeout={statement_timeout_ms}"
        }
    return kwargs


def install_pool_guard(app, service_name):
    """Map a saturated pool (checkout timeout) to a fast 503 with a metric.

    Without this, a pool-saturated service keeps timing requests out
    individually and the symptom is a wall of 500s with no signal; with it,
    operators see ``atlas_db_pool_exhausted_total`` move and callers get a
    retryable response immediately.
    """
    from fastapi.responses import JSONResponse

    @app.exception_handler(sa_exc.TimeoutError)
    async def _pool_exhausted(request, exc):  # pragma: no cover - wiring glue
        POOL_EXHAUSTED_TOTAL.labels(service=service_name).inc()
        logger.warning(
            "db.pool_exhausted",
            extra={"service": service_name, "path": request.url.path},
        )
        return JSONResponse(
            status_code=503,
            content={"detail": "Database pool busy, retry shortly"},
            headers={"Retry-After": "5"},
        )
