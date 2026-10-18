"""Database-free unit tests for the reporting engine (issue #497).

These tests cover the pure parts of the engine: role ladder, schedule math,
filtering, CSV rendering, the delivery abstraction, and the canned dataset
adapters with stubbed dependencies. The database-backed CRUD and HTTP surface
tests live in test_main.py, which runs against PostgreSQL in CI.
"""
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

import reporting
import report_delivery
from report_delivery import (
    LoggingDelivery,
    RecordingDelivery,
    ReportAttachment,
)


def _definition(**overrides):
    values = {
        "id": uuid.uuid4(),
        "tenant_id": "tenant-unit",
        "name": "Unit Report",
        "dataset": "headcount",
        "filters": {},
        "columns": ["department", "headcount"],
        "schedule": {"frequency": "daily", "hour": 6},
        "recipients": ["ops@example.com"],
        "required_role": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _run_stub(**overrides):
    values = {"id": uuid.uuid4(), "trigger": "manual"}
    values.update(overrides)
    return SimpleNamespace(**values)


def _stub_crud_writes(monkeypatch, finished: dict, created: dict = None):
    created = created if created is not None else {}

    def fake_create_run(db, tenant_id, definition_id, trigger="manual", run_as_role=None):
        created.update(
            tenant_id=tenant_id, definition_id=definition_id, trigger=trigger, run_as_role=run_as_role
        )
        return _run_stub(id=uuid.uuid4(), trigger=trigger)

    def fake_finish_run(db, run_id, data):
        finished.update(data)
        return SimpleNamespace(id=run_id, **data)

    def fake_mark_ran(db, definition, when, next_run_at=None):
        finished["next_run_at"] = next_run_at
        return definition

    monkeypatch.setattr(reporting.crud, "create_report_run", fake_create_run)
    monkeypatch.setattr(reporting.crud, "finish_report_run", fake_finish_run)
    monkeypatch.setattr(reporting.crud, "mark_report_definition_ran", fake_mark_ran)
    return created


# ── Role ladder ─────────────────────────────────────────────────────────────

def test_role_ladder_orders_known_roles():
    assert reporting.role_sufficient("admin", "employee")
    assert reporting.role_sufficient("hr", "manager")
    assert reporting.role_sufficient("admin", "admin")
    assert not reporting.role_sufficient("manager", "hr")
    assert not reporting.role_sufficient("employee", "admin")


def test_role_sufficient_open_definitions_and_unknown_roles():
    assert reporting.role_sufficient("employee", None)
    assert reporting.role_sufficient(None, None)
    assert not reporting.role_sufficient(None, "admin")
    assert not reporting.role_sufficient("contractor", "employee")


# ── Schedule math ───────────────────────────────────────────────────────────

def test_compute_next_run_daily_rolls_to_next_day():
    after = datetime(2026, 1, 5, 9, 30, tzinfo=timezone.utc)
    assert reporting.compute_next_run({"frequency": "daily", "hour": 6}, after=after) == datetime(
        2026, 1, 6, 6, 0, tzinfo=timezone.utc
    )
    assert reporting.compute_next_run({"frequency": "daily", "hour": 12}, after=after) == datetime(
        2026, 1, 5, 12, 0, tzinfo=timezone.utc
    )


def test_compute_next_run_weekly_lands_on_requested_weekday():
    after = datetime(2026, 1, 7, 10, 0, tzinfo=timezone.utc)  # Wednesday
    nxt = reporting.compute_next_run(
        {"frequency": "weekly", "day_of_week": 0, "hour": 8}, after=after
    )
    assert nxt == datetime(2026, 1, 12, 8, 0, tzinfo=timezone.utc)
    assert nxt.weekday() == 0


def test_compute_next_run_monthly_wraps_across_year():
    after = datetime(2026, 12, 20, 0, 0, tzinfo=timezone.utc)
    assert reporting.compute_next_run(
        {"frequency": "monthly", "day_of_month": 1, "hour": 7}, after=after
    ) == datetime(2027, 1, 1, 7, 0, tzinfo=timezone.utc)


def test_compute_next_run_handles_naive_timestamps_and_clamps_values():
    nxt = reporting.compute_next_run(
        {"frequency": "daily", "hour": 99, "minute": -4}, after=datetime(2026, 1, 5, 0, 0)
    )
    assert nxt == datetime(2026, 1, 5, 23, 0, tzinfo=timezone.utc)


def test_compute_next_run_returns_none_for_unscheduled_definitions():
    assert reporting.compute_next_run(None) is None
    assert reporting.compute_next_run({}) is None
    assert reporting.compute_next_run({"frequency": "hourly"}) is None


# ── Filtering, columns, CSV ─────────────────────────────────────────────────

def test_apply_filters_matches_exact_values():
    rows = [{"department": "Engineering"}, {"department": "Sales"}, {"department": "Sales"}]
    assert reporting.apply_filters(rows, {"department": "Sales"}) == [
        {"department": "Sales"},
        {"department": "Sales"},
    ]
    assert reporting.apply_filters(rows, None) == rows
    assert reporting.apply_filters(rows, {}) == rows


def test_apply_filters_ignores_reserved_and_unknown_keys():
    rows = [{"department": "Sales"}]
    # reserved configuration keys and fields the dataset does not expose
    assert reporting.apply_filters(rows, {"report_type": "SOC2"}) == rows
    assert reporting.apply_filters(rows, {"period": "2026-01"}) == rows


def test_apply_filters_coerces_numbers_for_matching():
    rows = [{"headcount": 4}, {"headcount": 9}]
    assert reporting.apply_filters(rows, {"headcount": "4"}) == [{"headcount": 4}]


def test_select_columns_keeps_requested_order_and_falls_back():
    available = ["a", "b", "c"]
    assert reporting.select_columns(available, ["c", "a"]) == ["c", "a"]
    assert reporting.select_columns(available, ["missing"]) == available
    assert reporting.select_columns(available, []) == available
    assert reporting.select_columns(available, None) == available


def test_rows_to_csv_escapes_commas_quotes_and_empty_values():
    csv_text = reporting.rows_to_csv(
        ["name", "note"], [{"name": 'Ac,me "Inc"', "note": None}]
    )
    lines = csv_text.splitlines()
    assert lines[0] == "name,note"
    assert '"Ac,me ""Inc""",' == lines[1]


def test_rows_to_csv_stringifies_nested_values():
    csv_text = reporting.rows_to_csv(["meta"], [{"meta": {"b": 2, "a": 1}}])
    assert '""b"": 2' in csv_text
    assert '""a"": 1' in csv_text


def test_build_attachment_records_metadata():
    definition = _definition()
    run = _run_stub()
    now = datetime(2026, 2, 1, 12, 0, tzinfo=timezone.utc)
    attachment = reporting.build_attachment(
        definition, run, ["department", "headcount"], [{"department": "Sales", "headcount": 4}], now
    )
    assert attachment.filename == f"unit-report-{run.id}.csv"
    assert attachment.content_type == "text/csv"
    assert "Sales,4" in attachment.content
    assert attachment.metadata["rows"] == 1
    assert attachment.metadata["tenant_id"] == "tenant-unit"
    assert attachment.metadata["generated_at"] == now.isoformat()
    assert attachment.metadata["trigger"] == "manual"


# ── Delivery abstraction ────────────────────────────────────────────────────

def test_recording_delivery_captures_reports_and_alerts():
    delivery = RecordingDelivery()
    definition = _definition()
    run = _run_stub()
    attachment = ReportAttachment(filename="x.csv", content="a,b\r\n1,2\r\n")
    result = delivery.send_report(definition, run, attachment)
    assert result.status == "DELIVERED"
    assert delivery.reports[0]["recipients"] == ["ops@example.com"]
    assert delivery.reports[0]["content"] == attachment.content
    alert = delivery.send_alert(definition, run, "boom")
    assert alert.status == "DELIVERED"
    assert delivery.alerts[0]["message"] == "boom"
    delivery.clear()
    assert delivery.reports == []
    assert delivery.alerts == []


def test_logging_delivery_is_honest_about_missing_email():
    result = LoggingDelivery().send_report(
        _definition(), _run_stub(), ReportAttachment(filename="x.csv", content="")
    )
    assert result.status == "NOT_CONFIGURED"


def test_set_delivery_swaps_the_module_default():
    original = report_delivery.get_delivery()
    stub = RecordingDelivery()
    try:
        report_delivery.set_delivery(stub)
        assert report_delivery.get_delivery() is stub
    finally:
        report_delivery.set_delivery(original)


# ── Dataset adapters ────────────────────────────────────────────────────────

def test_fetch_headcount_uses_injected_http_getter():
    calls = []

    def http_get(path, params):
        calls.append(path)
        return [{"department": "Engineering", "headcount": 12}]

    context = reporting.DatasetContext(
        db=None, tenant_id="acme", filters={}, http_get=http_get
    )
    result = reporting.fetch_headcount(context)
    assert calls == ["/analytics/department"]
    assert result.columns == ["department", "headcount"]
    assert result.rows == [{"department": "Engineering", "headcount": 12}]


def test_fetch_payroll_totals_uses_injected_http_getter():
    context = reporting.DatasetContext(
        db=None,
        tenant_id="acme",
        filters={},
        http_get=lambda path, params: [
            {"period": "2026-01", "total_base": 1000, "total_tax": 100, "total_net": 900}
        ],
    )
    result = reporting.fetch_payroll_totals(context)
    assert result.columns == ["period", "total_base", "total_tax", "total_net"]
    assert result.rows[0]["total_net"] == 900


def test_http_rows_accept_wrapped_items_payload():
    context = reporting.DatasetContext(
        db=None,
        tenant_id="acme",
        filters={},
        http_get=lambda path, params: {"items": [{"department": "Sales", "headcount": 2}], "total": 1},
    )
    assert reporting.fetch_headcount(context).rows == [{"department": "Sales", "headcount": 2}]


def test_fetch_compliance_posture_reuses_report_engine(monkeypatch):
    captured = {}

    def fake_report(db, tenant_id, report_type):
        captured["tenant_id"] = tenant_id
        captured["report_type"] = report_type
        return {
            "category": report_type.upper(),
            "generated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
            "tenant_id": tenant_id,
            "total_policies": 3,
            "enabled_policies": 2,
            "total_violations": 1,
            "open_violations": 1,
            "remediated_violations": 0,
            "status": "NON_COMPLIANT",
            "findings": [],
            "recommendations": [],
        }

    monkeypatch.setattr(reporting.crud, "generate_compliance_report", fake_report)
    context = reporting.DatasetContext(
        db=object(), tenant_id="acme", filters={"report_type": "GDPR"}, http_get=None
    )
    result = reporting.fetch_compliance_posture(context)
    assert captured == {"tenant_id": "acme", "report_type": "GDPR"}
    assert result.columns == ["metric", "value"]
    metrics = {row["metric"]: row["value"] for row in result.rows}
    assert metrics["status"] == "NON_COMPLIANT"
    assert metrics["open_violations"] == 1
    assert metrics["total_policies"] == 3


def test_fetch_audit_logs_maps_existing_listing(monkeypatch):
    created = datetime(2026, 3, 1, 9, 0, tzinfo=timezone.utc)
    log = SimpleNamespace(
        created_at=created,
        event_type="employee.created",
        actor_id="user-1",
        action="CREATE",
        resource_type="employee",
        resource_id="emp-1",
    )
    monkeypatch.setattr(
        reporting.crud, "list_audit_logs", lambda db, tenant_id, page, page_size: {"items": [log]}
    )
    context = reporting.DatasetContext(db=object(), tenant_id="acme", filters={"limit": 10})
    result = reporting.fetch_audit_logs(context)
    assert result.rows[0]["event_type"] == "employee.created"
    assert result.rows[0]["created_at"] == created.isoformat()
    assert result.rows[0]["action"] == "CREATE"


# ── Canned reports ──────────────────────────────────────────────────────────

def test_canned_reports_cover_the_required_three():
    assert set(reporting.CANNED_REPORTS) == {"headcount", "payroll_totals", "compliance_posture"}
    for template in reporting.CANNED_REPORTS.values():
        assert template["dataset"] in reporting.DATASET_FETCHERS
        assert reporting.compute_next_run(template["schedule"]) is not None


def test_canned_definitions_are_scheduled_with_a_role():
    for template in reporting.CANNED_REPORTS.values():
        assert template["schedule"].get("run_as_role") in reporting.ROLE_LEVELS


# ── Runner (with stubbed persistence) ───────────────────────────────────────

def test_execute_succeeds_delivers_csv_and_schedules_next_run(monkeypatch):
    definition = _definition(schedule={"frequency": "daily", "hour": 6})
    finished = {}
    _stub_crud_writes(monkeypatch, finished)
    monkeypatch.setitem(
        reporting.DATASET_FETCHERS,
        "headcount",
        lambda context: reporting.DatasetResult(
            columns=["department", "headcount"], rows=[{"department": "Sales", "headcount": 3}]
        ),
    )
    delivery = RecordingDelivery()
    reporting.execute_report_definition(
        object(), definition, trigger="manual", run_as_role="hr", delivery=delivery
    )
    assert finished["status"] == "SUCCEEDED"
    assert finished["rows"] == 1
    assert finished["delivery_status"] == "DELIVERED"
    assert delivery.reports[0]["content"] == "department,headcount\r\nSales,3\r\n"
    assert finished["next_run_at"] is not None


def test_execute_suppresses_below_required_role(monkeypatch):
    definition = _definition(required_role="admin")
    finished = {}
    created = _stub_crud_writes(monkeypatch, finished)
    delivery = RecordingDelivery()
    reporting.execute_report_definition(
        object(), definition, trigger="manual", run_as_role="employee", delivery=delivery
    )
    assert finished["status"] == "SUPPRESSED"
    assert "below required role" in finished["error"]
    assert delivery.reports == []
    assert len(delivery.alerts) == 1
    assert created["run_as_role"] == "employee"


def test_execute_records_failure_and_alerts(monkeypatch):
    definition = _definition()

    def boom(context):
        raise RuntimeError("analytics unavailable")

    finished = {}
    _stub_crud_writes(monkeypatch, finished)
    monkeypatch.setitem(reporting.DATASET_FETCHERS, "headcount", boom)
    delivery = RecordingDelivery()
    reporting.execute_report_definition(
        object(), definition, trigger="schedule", run_as_role="hr", delivery=delivery
    )
    assert finished["status"] == "FAILED"
    assert "analytics unavailable" in finished["error"]
    assert delivery.alerts[0]["message"].startswith("Report run failed")
    assert "next_run_at" not in finished or finished["next_run_at"] is None


def test_run_due_uses_the_schedule_role(monkeypatch):
    definition = _definition(schedule={"frequency": "daily", "run_as_role": "hr"})
    monkeypatch.setattr(
        reporting.crud,
        "get_due_report_definitions",
        lambda db, now, limit=20, tenant_id=None: [definition],
    )
    calls = []

    def fake_execute(db, target, **kwargs):
        calls.append(kwargs)
        return "run"

    monkeypatch.setattr(reporting, "execute_report_definition", fake_execute)
    runs = reporting.run_due_report_definitions(object(), tenant_id="tenant-unit")
    assert runs == ["run"]
    assert calls[0]["trigger"] == "schedule"
    assert calls[0]["run_as_role"] == "hr"
