"""Tenant-keyed cache-aside read cache shared by the Atlas Python services.

Hot read endpoints (analytics aggregates, dashboards, the employee
directory) request the same rows on every load. This module provides a
small cache-aside helper: each call names an endpoint class, a tenant id
and a loader; on miss the loader runs (at most once per key at a time, so
a thundering herd of concurrent misses produces a single upstream call),
and the JSON-serialized payload is stored with a per-endpoint TTL.

Backends: when REDIS_URL is set and the ``redis`` package is importable,
payloads live in Redis (keyed per tenant), so invalidation from one
process is visible to every worker. When either is missing or Redis
errors, the cache silently degrades to a small in-process store, and when
both are unusable the loader still runs - a cache failure must never turn
into a 500.

This helper is explicitly NOT for auth, session, rate-limit or other
security-relevant decisions: those must be recomputed on every request.
"""

import asyncio
import json
import logging
import os
import threading
import time

from prometheus_client import Counter

try:
    import redis as redis_lib
except ImportError:  # pragma: no cover - depends on the service image
    redis_lib = None

logger = logging.getLogger(__name__)

CACHE_HITS = Counter(
    "atlas_cache_hits_total",
    "Read-cache hits by service, endpoint and backend",
    labelnames=["service", "endpoint", "backend"],
)

CACHE_MISSES = Counter(
    "atlas_cache_misses_total",
    "Read-cache misses by service, endpoint and backend",
    labelnames=["service", "endpoint", "backend"],
)

CACHE_INVALIDATIONS = Counter(
    "atlas_cache_invalidations_total",
    "Read-cache invalidations by service, endpoint and backend",
    labelnames=["service", "endpoint", "backend"],
)

# A member of the herd that misses the flight window computes its own copy
# instead of waiting forever; the flight window only has to be longer than
# a typical upstream call.
SINGLE_FLIGHT_WAIT_SECONDS = 30.0

# Bound on the in-process fallback store so a large cardinality of tenant
# or query-parameter keys cannot grow unbounded in memory.
MAX_LOCAL_KEYS = 4096


def _safe_part(value):
    """Reduce a free-form tenant/endpoint id to one key segment."""
    return (value or "default").replace(":", "_").replace("*", "_")


class _Store:
    """Storage and key logic shared by the sync and async read caches.

    The store never raises: whenever Redis is absent, unreachable, or
    returns something unusable the payload falls back to (or straight
    through) the in-process mirror, so a cache outage degrades to database
    traffic instead of failing requests.
    """

    backend = "local"

    def __init__(self, service_name, key_prefix="atlas:cache", redis_url=None):
        self.service_name = service_name
        self.key_prefix = key_prefix
        if redis_url is None:
            redis_url = os.environ.get("REDIS_URL", "")
        self._client = self._open_redis(redis_url)
        if self._client is not None:
            self.backend = "redis"
        self._store = {}
        self._store_lock = threading.Lock()

    def _open_redis(self, redis_url):
        if not redis_url or redis_lib is None:
            return None
        try:
            client = redis_lib.Redis.from_url(
                redis_url,
                decode_responses=True,
                socket_timeout=1,
                socket_connect_timeout=1,
            )
            client.ping()
            return client
        except Exception as e:
            logger.info(
                "cache.redis_unavailable",
                extra={"service": self.service_name, "error": type(e).__name__},
            )
            return None

    def make_key(self, endpoint, tenant_id, discriminator=""):
        """Deterministic, tenant-scoped key shared by readers, callers and
        invalidators. Free-form parts are escaped into one clean segment."""
        key = (
            f"{self.key_prefix}:{_safe_part(self.service_name)}:"
            f"{_safe_part(endpoint)}:{_safe_part(tenant_id)}"
        )
        if discriminator:
            key = f"{key}:{_safe_part(discriminator)}"
        return key

    def _redis_get(self, key):
        try:
            raw = self._client.get(key)
        except Exception as e:
            logger.warning(
                "cache.redis_get_failed",
                extra={"service": self.service_name, "error": type(e).__name__},
            )
            return None
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (ValueError, TypeError, UnicodeError):
            return None

    def _local_get(self, key):
        with self._store_lock:
            entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.monotonic() >= expires_at:
            with self._store_lock:
                if self._store.get(key) is entry:
                    self._store.pop(key, None)
            return None
        return value

    def get(self, key):
        if self._client is not None:
            value = self._redis_get(key)
            if value is not None:
                return value
        return self._local_get(key)

    def _bound_local_store(self):
        with self._store_lock:
            if len(self._store) < MAX_LOCAL_KEYS:
                return
            now = time.monotonic()
            expired = [k for k, (expires_at, _) in self._store.items() if now >= expires_at]
            for k in expired:
                self._store.pop(k, None)
            while len(self._store) >= MAX_LOCAL_KEYS:
                # Dicts preserve insertion order, so the oldest payload goes.
                self._store.pop(next(iter(self._store)))

    def _redis_set(self, key, value, ttl_seconds):
        if self._client is None:
            return
        try:
            self._client.setex(key, max(1, int(ttl_seconds)), json.dumps(value, default=str))
        except Exception as e:
            logger.warning(
                "cache.redis_set_failed",
                extra={"service": self.service_name, "error": type(e).__name__},
            )

    def set(self, key, value, ttl_seconds):
        expires_at = time.monotonic() + max(0.0, float(ttl_seconds))
        self._bound_local_store()
        with self._store_lock:
            self._store[key] = (expires_at, value)
        self._redis_set(key, value, ttl_seconds)

    def _redis_delete(self, keys):
        if self._client is None:
            return
        try:
            self._client.delete(*set(keys))
        except Exception as e:
            logger.warning(
                "cache.redis_delete_failed",
                extra={"service": self.service_name, "error": type(e).__name__},
            )

    def _redis_scan(self, pattern):
        if self._client is None:
            return []
        try:
            return list(self._client.scan_iter(match=pattern, count=100))
        except Exception as e:
            logger.warning(
                "cache.redis_scan_failed",
                extra={"service": self.service_name, "error": type(e).__name__},
            )
            return []

    def invalidate(self, keys, endpoint=""):
        """Drop exact cache keys; called from a write path that knows every
        key it affects."""
        keys = list(keys)
        with self._store_lock:
            for key in keys:
                self._store.pop(key, None)
        self._redis_delete(keys)
        logger.info("cache.invalidated", extra={"service": self.service_name, "keys": len(keys)})
        CACHE_INVALIDATIONS.labels(
            service=self.service_name, endpoint=endpoint or "unknown", backend=self.backend
        ).inc()

    def invalidate_tenant(self, endpoint, tenant_id):
        """Drop every cache key for one tenant and endpoint class, for write
        paths whose reads are parameterised (pagination, search)."""
        prefix = self.make_key(endpoint, tenant_id)
        local_hits = []
        with self._store_lock:
            for key in list(self._store):
                if key == prefix or key.startswith(prefix + ":"):
                    local_hits.append(key)
                    self._store.pop(key, None)
        keys = list(local_hits)
        keys.extend(self._redis_scan(prefix + "*"))
        if keys:
            self._redis_delete(keys)
        logger.info("cache.invalidated", extra={"service": self.service_name, "keys": len(keys)})
        CACHE_INVALIDATIONS.labels(
            service=self.service_name, endpoint=endpoint, backend=self.backend
        ).inc()

    def clear(self):
        """Drop everything, local and remote - used by tests and admin ops."""
        with self._store_lock:
            self._store.clear()
        for key in self._redis_scan(f"{self.key_prefix}:*"):
            self._redis_delete([key])


class ReadCache(_Store):
    """Synchronous cache-aside helper for sync endpoints and workers."""

    def __init__(self, service_name, **kwargs):
        super().__init__(service_name, **kwargs)
        self._flight_guard = threading.Lock()
        self._flight = {}

    def _flight_for(self, key):
        with self._flight_guard:
            flight = self._flight.get(key)
            if flight is None:
                flight = threading.Lock()
                self._flight[key] = flight
            return flight

    def cached(self, key, ttl_seconds, loader, endpoint="unknown"):
        """Return the stored payload for ``key``, calling ``loader`` on miss.

        Concurrent misses on the same key join the flight and wait for the
        first loader to finish instead of stampeding the upstream. If the
        flight window elapses (or the store layer is unusable) the caller
        computes its own copy - read paths degrade, never fail.
        """
        value = self.get(key)
        if value is not None:
            CACHE_HITS.labels(service=self.service_name, endpoint=endpoint, backend=self.backend).inc()
            return value
        CACHE_MISSES.labels(service=self.service_name, endpoint=endpoint, backend=self.backend).inc()

        flight = self._flight_for(key)

        if flight.acquire(timeout=SINGLE_FLIGHT_WAIT_SECONDS):
            try:
                # The winning loader may have filled the cache while we waited.
                value = self.get(key)
                if value is not None:
                    CACHE_HITS.labels(
                        service=self.service_name, endpoint=endpoint, backend=self.backend
                    ).inc()
                    return value
                value = loader()
                if value is not None:
                    self.set(key, value, ttl_seconds)
                return value
            finally:
                flight.release()
        logger.warning(
            "cache.single_flight_timeout",
            extra={"service": self.service_name, "key": key},
        )
        return loader()


class AsyncReadCache(_Store):
    """Async cache-aside helper for async endpoints (asyncio loaders).

    Mirrors :class:`ReadCache` with asyncio single-flight, so one miss
    inside an event loop serializes the herd without blocking it. Waiters
    receive the winner's payload; if the flight window elapses a waiter
    computes its own copy. Redis and the fallback store are accessed
    synchronously with short timeouts because a hit must stay cheap; a
    hung Redis times out in one second and the read falls through.
    """

    def __init__(self, service_name, **kwargs):
        super().__init__(service_name, **kwargs)
        self._flights = {}
        self._flight_guard = asyncio.Lock()

    async def _flight_for(self, key):
        async with self._flight_guard:
            flight = self._flights.get(key)
            if flight is None:
                flight = _AsyncFlight()
                self._flights[key] = flight
            return flight

    async def acached(self, key, ttl_seconds, loader, endpoint="unknown"):
        value = self.get(key)
        if value is not None:
            CACHE_HITS.labels(service=self.service_name, endpoint=endpoint, backend=self.backend).inc()
            return value
        CACHE_MISSES.labels(service=self.service_name, endpoint=endpoint, backend=self.backend).inc()

        flight = await self._flight_for(key)
        is_leader, future = await flight.join_or_lead()
        if is_leader:
            try:
                # The winning loader may have filled the cache before us.
                value = self.get(key)
                if value is not None:
                    CACHE_HITS.labels(
                        service=self.service_name, endpoint=endpoint, backend=self.backend
                    ).inc()
                    return value
                try:
                    value = await loader()
                except BaseException as e:
                    flight.fail(e)
                    raise
                flight.publish(value)
                if value is not None:
                    self.set(key, value, ttl_seconds)
                return value
            finally:
                flight.done()
        try:
            winner_value = await asyncio.wait_for(future, SINGLE_FLIGHT_WAIT_SECONDS)
        except (asyncio.TimeoutError, TimeoutError):
            # The winner is still computing after the window: copy alone.
            logger.warning(
                "cache.single_flight_timeout",
                extra={"service": self.service_name, "key": key},
            )
            return await loader()
        if winner_value is not None:
            CACHE_HITS.labels(
                service=self.service_name, endpoint=endpoint, backend=self.backend
            ).inc()
            return winner_value
        # The winner produced nothing cacheable; compute our own copy.
        return await loader()


class _AsyncFlight:
    """Per-key single-flight slot: one lead task runs the loader, every
    other arrival waits on the shared result (or falls back on timeout)."""

    def __init__(self):
        self._future = None

    async def join_or_lead(self):
        """Claim the loader slot (True, future) or join the winner (False,
        future to await)."""
        if self._future is None:
            self._future = asyncio.get_running_loop().create_future()
            return True, self._future
        return False, self._future

    def publish(self, value):
        if self._future is not None and not self._future.done():
            self._future.set_result(value)

    def fail(self, exc):
        if self._future is not None and not self._future.done():
            self._future.set_exception(exc)

    def done(self):
        self._future = None
