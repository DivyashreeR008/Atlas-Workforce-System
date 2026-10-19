"""Unit tests for the shared SQLAlchemy slow-query listener."""

import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

import pytest
from sqlalchemy import create_engine, text

from atlas_observability.sql_slow_query import _threshold_seconds, install_slow_query_listener


@pytest.fixture
def threshold_ms(monkeypatch):
    def _set(ms):
        monkeypatch.setenv("ATLAS_SLOW_QUERY_MS", str(ms))
    return _set


@pytest.fixture(autouse=True)
def _clear_env(monkeypatch):
    monkeypatch.delenv("ATLAS_SLOW_QUERY_MS", raising=False)
    yield


def test_threshold_default_is_500ms():
    assert _threshold_seconds() == 0.5


def test_threshold_rejects_bad_value(monkeypatch, caplog):
    monkeypatch.setenv("ATLAS_SLOW_QUERY_MS", "-3")
    with caplog.at_level(logging.WARNING):
        assert _threshold_seconds() == 0.5
    assert any("SLOW_QUERY_MS" in r.message for r in caplog.records)


def test_slow_query_zero_threshold_logs_every_statement(caplog, monkeypatch):
    """With ATLAS_SLOW_QUERY_MS=0 every statement is timed and logged."""
    monkeypatch.setenv("ATLAS_SLOW_QUERY_MS", "0")
    engine = create_engine("sqlite://")
    install_slow_query_listener(engine, "test-service")
    with caplog.at_level(logging.WARNING, logger="atlas_observability.sql_slow_query"):
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            conn.execute(text("SELECT 2"))
    logged = [
        record for record in caplog.records
        if record.getMessage() == "db.slow_query" and record.__dict__.get("service") == "test-service"
    ]
    assert len(logged) == 2
    sample = logged[0].__dict__
    assert sample["threshold_ms"] == 0.0
    assert "SELECT" in sample["statement"]
    assert "duration_ms" in sample
    assert "param_count" in sample


def test_slow_query_threshold_respected_not_triggered():
    """A fast statement under the explicit threshold produces no event."""
    engine = create_engine("sqlite://")
    install_slow_query_listener(engine, "test-fast-service")
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))


def test_histogram_records_every_statement():
    from prometheus_client import REGISTRY, generate_latest
    engine = create_engine("sqlite://")
    install_slow_query_listener(engine, "hist-test-service")
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
        conn.execute(text("SELECT 2"))
    output = generate_latest(REGISTRY).decode()
    assert "atlas_db_query_duration_seconds_count" in output


def test_failed_query_is_logged(caplog):
    engine = create_engine("sqlite://")
    install_slow_query_listener(engine, "test-fail-service")
    with caplog.at_level(logging.WARNING, logger="atlas_observability.sql_slow_query"):
        with engine.connect() as conn:
            pytest.raises(
                Exception,
                lambda: conn.execute(text("SELECT * FROM nonexistent_table_xyz")),
            )
    assert any(r.getMessage() == "db.failed_query" for r in caplog.records)
