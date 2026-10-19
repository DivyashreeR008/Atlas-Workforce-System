"""Unit tests for the shared DB pool / statement-timeout configuration."""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import exc as sa_exc

from atlas_observability.db_pool_config import (
    DEFAULTS,
    engine_kwargs,
    install_pool_guard,
)


@pytest.fixture(autouse=True)
def _clear_env(monkeypatch):
    for name in DEFAULTS:
        monkeypatch.delenv(name, raising=False)
        monkeypatch.delenv(f"SVC_{name}", raising=False)
    yield


def test_defaults_are_bounded_and_documented():
    kwargs = engine_kwargs("postgresql://u:p@h:5432/db")
    assert kwargs["pool_size"] == 5
    assert kwargs["max_overflow"] == 10
    assert kwargs["pool_recycle"] == 1800
    assert kwargs["pool_timeout"] == 10
    assert kwargs["pool_pre_ping"] is True
    # PostgreSQL URLs get a statement_timeout through connect_args.
    assert "statement_timeout=15000" in kwargs["connect_args"]["options"]


def test_env_overrides_apply(monkeypatch):
    monkeypatch.setenv("SVC_DATABASE_STATEMENT_TIMEOUT_MS", "3000")
    monkeypatch.setenv("SVC_DATABASE_POOL_SIZE", "2")
    monkeypatch.setenv("SVC_DATABASE_MAX_OVERFLOW", "1")
    kwargs = engine_kwargs("postgresql://h/db", prefix="svc")
    assert "statement_timeout=3000" in kwargs["connect_args"]["options"]
    assert kwargs["pool_size"] == 2
    assert kwargs["max_overflow"] == 1


def test_invalid_env_falls_back_to_default(monkeypatch):
    monkeypatch.setenv("DATABASE_POOL_SIZE", "not-a-number")
    kwargs = engine_kwargs("postgresql://h/db")
    assert kwargs["pool_size"] == DEFAULTS["DATABASE_POOL_SIZE"]


def test_non_postgres_url_gets_no_pg_connect_args():
    """SQLite unit harnesses must not receive server-only options."""
    kwargs = engine_kwargs("sqlite://")
    assert "connect_args" not in kwargs


def test_empty_timeout_env_uses_default(monkeypatch):
    monkeypatch.setenv("DATABASE_STATEMENT_TIMEOUT_MS", "")
    kwargs = engine_kwargs("postgresql://h/db")
    assert "statement_timeout=15000" in kwargs["connect_args"]["options"]


def test_pool_guard_returns_503_with_metric(monkeypatch):
    """A saturated pool (checkout TimeoutError) degrades fast, not slowly."""
    from prometheus_client import REGISTRY, generate_latest

    app = FastAPI()
    install_pool_guard(app, "guard-test-service")

    @app.get("/heavy")
    async def heavy():
        raise sa_exc.TimeoutError("QueuePool limit reached")

    client = TestClient(app, raise_server_exceptions=False)
    resp = client.get("/heavy")
    assert resp.status_code == 503
    assert resp.headers.get("Retry-After") == "5"
    assert "busy" in resp.json()["detail"]
    output = generate_latest(REGISTRY).decode()
    assert 'atlas_db_pool_exhausted_total{service="guard-test-service"}' in output


def test_pool_guard_does_not_swallow_other_errors():
    app = FastAPI()
    install_pool_guard(app, "guard-other-service")

    @app.get("/boom")
    async def boom():
        raise ValueError("unexpected")

    client = TestClient(app, raise_server_exceptions=False)
    assert client.get("/boom").status_code == 500
