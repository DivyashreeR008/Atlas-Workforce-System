"""Reporting engine: definitions, canned reports, dataset adapters, runner.

The runner deliberately reuses existing code paths for data instead of
re-querying tables: the compliance posture dataset calls
``crud.generate_compliance_report`` and the audit dataset calls
``crud.list_audit_logs``. Headcount and payroll totals are fetched from the
analytics service's existing aggregate endpoints over the internal API; tests
inject a stub HTTP getter through ``DatasetContext``.
"""
import csv
import io
import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional
from urllib.parse import urljoin

from atlas_observability import mint_internal_auth

import crud
from report_delivery import ReportAttachment, ReportDelivery, get_delivery

logger = logging.getLogger("audit-compliance-service")

ANALYTICS_SERVICE_URL = os.environ.get(
    "ANALYTICS_SERVICE_URL", "http://analytics-python-service:8003"
)
INTERNAL_JWT_SECRET = os.environ.get("INTERNAL_JWT_SECRET", "")
ANALYTICS_GET_TIMEOUT_SEC = 15.0

ROLE_LEVELS = {"employee": 1, "manager": 2, "hr": 3, "admin": 4}

# Keys allowed in the filters dict but never used for row matching.
RESERVED_FILTER_KEYS = frozenset({"report_type", "limit"})


def role_sufficient(role: Optional[str], required_role: Optional[str]) -> bool:
    """True when ``role`` is at least ``required_role`` in the role ladder."""
    if not required_role:
        return True
    if not role:
        return False
    return ROLE_LEVELS.get(str(role), 0) >= ROLE_LEVELS.get(str(required_role), 0)


@dataclass
class DatasetResult:
    columns: list[str]
    rows: list[dict] = field(default_factory=list)


@dataclass
class DatasetContext:
    db: object
    tenant_id: str
    filters: dict = field(default_factory=dict)
    http_get: Optional[Callable] = None


def _rows_from_payload(payload) -> list[dict]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        items = payload.get("items")
        if isinstance(items, list):
            return [row for row in items if isinstance(row, dict)]
        return [payload]
    return []


def _analytics_http_get(context: DatasetContext, path: str, params: Optional[dict] = None) -> list[dict]:
    if context.http_get is not None:
        return _rows_from_payload(context.http_get(path, params))
    if not INTERNAL_JWT_SECRET:
        raise RuntimeError("INTERNAL_JWT_SECRET is required to fetch analytics datasets")
    import httpx

    token = mint_internal_auth(
        INTERNAL_JWT_SECRET,
        service="audit-compliance-service",
        tenant_id=context.tenant_id,
        audience="analytics-reader",
        ttl_seconds=60,
    )
    url = urljoin(ANALYTICS_SERVICE_URL.rstrip("/") + "/", path.lstrip("/"))
    response = httpx.get(
        url,
        params=params,
        headers={"x-internal-auth": token, "X-Tenant-Id": context.tenant_id},
        timeout=ANALYTICS_GET_TIMEOUT_SEC,
    )
    response.raise_for_status()
    return _rows_from_payload(response.json())


# ── Dataset adapters ────────────────────────────────────────────────────────


def fetch_headcount(context: DatasetContext) -> DatasetResult:
    rows = _analytics_http_get(context, "/analytics/department")
    return DatasetResult(columns=["department", "headcount"], rows=rows)


def fetch_payroll_totals(context: DatasetContext) -> DatasetResult:
    rows = _analytics_http_get(context, "/analytics/payroll")
    return DatasetResult(
        columns=["period", "total_base", "total_tax", "total_net"],
        rows=rows,
    )


def fetch_compliance_posture(context: DatasetContext) -> DatasetResult:
    report_type = str((context.filters or {}).get("report_type") or "SOC2")
    report = crud.generate_compliance_report(context.db, context.tenant_id, report_type)
    rows = [
        {"metric": "report_type", "value": report["category"]},
        {"metric": "status", "value": report["status"]},
        {"metric": "total_policies", "value": report["total_policies"]},
        {"metric": "enabled_policies", "value": report["enabled_policies"]},
        {"metric": "total_violations", "value": report["total_violations"]},
        {"metric": "open_violations", "value": report["open_violations"]},
        {"metric": "remediated_violations", "value": report["remediated_violations"]},
    ]
    return DatasetResult(columns=["metric", "value"], rows=rows)


def fetch_audit_logs(context: DatasetContext) -> DatasetResult:
    limit = int((context.filters or {}).get("limit") or 500)
    page = crud.list_audit_logs(context.db, tenant_id=context.tenant_id, page=1, page_size=min(limit, 500))
    rows = [
        {
            "created_at": log.created_at.isoformat() if log.created_at else "",
            "event_type": log.event_type,
            "actor_id": log.actor_id,
            "action": log.action or "",
            "resource_type": log.resource_type or "",
            "resource_id": log.resource_id or "",
        }
        for log in page["items"]
    ]
    return DatasetResult(
        columns=["created_at", "event_type", "actor_id", "action", "resource_type", "resource_id"],
        rows=rows,
    )


DATASET_FETCHERS: dict[str, Callable[[DatasetContext], DatasetResult]] = {
    "headcount": fetch_headcount,
    "payroll_totals": fetch_payroll_totals,
    "compliance_posture": fetch_compliance_posture,
    "audit_logs": fetch_audit_logs,
}


# ── Canned reports ──────────────────────────────────────────────────────────


CANNED_REPORTS: dict[str, dict] = {
    "headcount": {
        "key": "headcount",
        "name": "Monthly Headcount",
        "dataset": "headcount",
        "description": "Headcount grouped by department, from the analytics service aggregate.",
        "filters": {},
        "columns": ["department", "headcount"],
        "schedule": {"frequency": "monthly", "day_of_month": 1, "hour": 7, "run_as_role": "hr"},
    },
    "payroll_totals": {
        "key": "payroll_totals",
        "name": "Monthly Payroll Totals",
        "dataset": "payroll_totals",
        "description": "Payroll totals by period (base, tax, net), from the analytics service aggregate.",
        "filters": {},
        "columns": ["period", "total_base", "total_tax", "total_net"],
        "schedule": {"frequency": "monthly", "day_of_month": 2, "hour": 7, "run_as_role": "hr"},
    },
    "compliance_posture": {
        "key": "compliance_posture",
        "name": "Weekly Compliance Posture",
        "dataset": "compliance_posture",
        "description": "SOC2 readiness summary generated by the compliance report engine.",
        "filters": {"report_type": "SOC2"},
        "columns": ["metric", "value"],
        "schedule": {"frequency": "weekly", "day_of_week": 0, "hour": 8, "run_as_role": "admin"},
    },
}


def install_canned_report(
    db,
    tenant_id: str,
    key: str,
    recipients: Optional[list] = None,
    created_by: Optional[str] = None,
    schedule: Optional[dict] = None,
) -> tuple:
    """Create the definition for a canned report; idempotent on tenant+name."""
    from models import ReportDefinition

    template = CANNED_REPORTS.get(key)
    if not template:
        raise ValueError(f"Unknown canned report: {key}")
    existing = (
        db.query(ReportDefinition)
        .filter(ReportDefinition.tenant_id == tenant_id, ReportDefinition.name == template["name"])
        .first()
    )
    if existing:
        return existing, False
    data = {
        "name": template["name"],
        "dataset": template["dataset"],
        "filters": dict(template["filters"]),
        "columns": list(template["columns"]),
        "schedule": dict(schedule if schedule is not None else template["schedule"]),
        "recipients": list(recipients or []),
        "enabled": True,
    }
    definition = crud.create_report_definition(
        db,
        tenant_id,
        data,
        created_by=created_by,
        next_run_at=compute_next_run(data["schedule"]),
    )
    return definition, True


# ── Scheduling ──────────────────────────────────────────────────────────────


def _clamp(value, low: int, high: int, default: int) -> int:
    try:
        return max(low, min(high, int(value)))
    except (TypeError, ValueError):
        return default


def compute_next_run(schedule: Optional[dict], after: Optional[datetime] = None) -> Optional[datetime]:
    """Next UTC run time for a schedule dict, or None when unscheduled.

    Supported frequencies: daily, weekly (day_of_week 0=Monday), monthly
    (day_of_month 1-28). Hour/minute are UTC.
    """
    if not schedule or not isinstance(schedule, dict):
        return None
    frequency = str(schedule.get("frequency") or "").lower()
    if frequency not in ("daily", "weekly", "monthly"):
        return None
    base = after or datetime.now(timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    base = base.astimezone(timezone.utc)
    hour = _clamp(schedule.get("hour", 6), 0, 23, 6)
    minute = _clamp(schedule.get("minute", 0), 0, 59, 0)

    if frequency == "daily":
        candidate = base.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= base:
            candidate += timedelta(days=1)
        return candidate

    if frequency == "weekly":
        day = _clamp(schedule.get("day_of_week", 0), 0, 6, 0)
        candidate = base.replace(hour=hour, minute=minute, second=0, microsecond=0)
        candidate += timedelta(days=(day - candidate.weekday()) % 7)
        if candidate <= base:
            candidate += timedelta(days=7)
        return candidate

    day = _clamp(schedule.get("day_of_month", 1), 1, 28, 1)
    candidate = base.replace(day=day, hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= base:
        year = candidate.year + (1 if candidate.month == 12 else 0)
        month = 1 if candidate.month == 12 else candidate.month + 1
        candidate = candidate.replace(year=year, month=month)
    return candidate


# ── CSV rendering ───────────────────────────────────────────────────────────


def _stringify(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str)
    return str(value)


def select_columns(available: list[str], requested: Optional[list]) -> list[str]:
    if not requested:
        return list(available)
    known = set(available)
    selected = [column for column in requested if column in known]
    return selected or list(available)


def apply_filters(rows: list[dict], filters: Optional[dict]) -> list[dict]:
    """Exact-match row filters.

    Reserved keys (report_type, limit, ...) are configuration for the dataset
    fetcher, not row filters. A filter key the dataset does not expose is
    ignored rather than silently emptying the report.
    """
    if not filters or not rows:
        return list(rows)
    active = {
        key: value
        for key, value in filters.items()
        if key not in RESERVED_FILTER_KEYS
        and value is not None
        and any(key in row for row in rows)
    }
    if not active:
        return list(rows)
    return [
        row
        for row in rows
        if all(_stringify(row.get(key)) == _stringify(value) for key, value in active.items())
    ]


def rows_to_csv(columns: list[str], rows: list[dict]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(columns)
    for row in rows:
        writer.writerow([_stringify(row.get(column)) for column in columns])
    return output.getvalue()


def build_attachment(definition, run, columns: list[str], rows: list[dict], now: datetime) -> ReportAttachment:
    csv_text = rows_to_csv(columns, rows)
    filename = f"{definition.name.lower().replace(' ', '-')}-{run.id}.csv"
    return ReportAttachment(
        filename=filename,
        content=csv_text,
        metadata={
            "tenant_id": definition.tenant_id,
            "definition": definition.name,
            "dataset": definition.dataset,
            "generated_at": now.isoformat(),
            "filters": dict(definition.filters or {}),
            "columns": list(columns),
            "rows": len(rows),
            "trigger": run.trigger,
            "run_id": str(run.id),
        },
    )


# ── Runner ──────────────────────────────────────────────────────────────────


def _fetch_for_definition(context: DatasetContext, dataset: str) -> DatasetResult:
    fetcher = DATASET_FETCHERS.get(dataset)
    if fetcher is None:
        raise ValueError(f"Unknown dataset: {dataset}")
    return fetcher(context)


def execute_report_definition(
    db,
    definition,
    trigger: str = "manual",
    run_as_role: Optional[str] = None,
    delivery: Optional[ReportDelivery] = None,
    context: Optional[DatasetContext] = None,
    now: Optional[datetime] = None,
) -> object:
    """Run a definition: fetch, render CSV, deliver, record history.

    Returns the finished ReportRun row. RBAC is enforced before any data is
    fetched: a run whose role is below ``definition.required_role`` is recorded
    as SUPPRESSED and only an alert is delivered.
    """
    delivery = delivery or get_delivery()
    now = now or datetime.now(timezone.utc)
    run = crud.create_report_run(
        db,
        tenant_id=definition.tenant_id,
        definition_id=definition.id,
        trigger=trigger,
        run_as_role=run_as_role,
    )

    if definition.required_role and not role_sufficient(run_as_role, definition.required_role):
        message = (
            f"Suppressed: role '{run_as_role or 'unknown'}' is below required role "
            f"'{definition.required_role}'"
        )
        alert = delivery.send_alert(definition, run, message)
        logger.warning(
            "report.run_suppressed",
            extra={"definition_id": str(definition.id), "run_id": str(run.id), "reason": message},
        )
        return crud.finish_report_run(db, run.id, {
            "status": "SUPPRESSED",
            "error": message,
            "delivery_status": alert.status,
            "delivery_detail": alert.detail,
            "finished_at": datetime.now(timezone.utc),
        })

    try:
        context = context or DatasetContext(
            db=db, tenant_id=definition.tenant_id, filters=definition.filters or {}
        )
        result = _fetch_for_definition(context, definition.dataset)
        rows = apply_filters(result.rows, definition.filters)
        columns = select_columns(result.columns, definition.columns)
        attachment = build_attachment(definition, run, columns, rows, now)
        delivery_result = delivery.send_report(definition, run, attachment)
        finished = crud.finish_report_run(db, run.id, {
            "status": "SUCCEEDED",
            "rows": len(rows),
            "attachment_name": attachment.filename,
            "delivery_status": delivery_result.status,
            "delivery_detail": delivery_result.detail,
            "finished_at": datetime.now(timezone.utc),
        })
    except Exception as exc:
        message = f"{type(exc).__name__}: {exc}"
        logger.exception(
            "report.run_failed",
            extra={"definition_id": str(definition.id), "run_id": str(run.id)},
        )
        alert = delivery.send_alert(definition, run, f"Report run failed: {message}")
        return crud.finish_report_run(db, run.id, {
            "status": "FAILED",
            "error": message[:2000],
            "delivery_status": alert.status,
            "delivery_detail": alert.detail,
            "finished_at": datetime.now(timezone.utc),
        })

    crud.mark_report_definition_ran(
        db,
        definition,
        now,
        next_run_at=compute_next_run(definition.schedule, after=now),
    )
    return finished


def run_due_report_definitions(
    db,
    now: Optional[datetime] = None,
    delivery: Optional[ReportDelivery] = None,
    limit: int = 20,
    tenant_id: Optional[str] = None,
) -> list:
    now = now or datetime.now(timezone.utc)
    due = crud.get_due_report_definitions(db, now, limit=limit, tenant_id=tenant_id)
    runs = []
    for definition in due:
        schedule = definition.schedule if isinstance(definition.schedule, dict) else {}
        run_as_role = schedule.get("run_as_role") or "employee"
        runs.append(execute_report_definition(
            db,
            definition,
            trigger="schedule",
            run_as_role=run_as_role,
            delivery=delivery,
            now=now,
        ))
    return runs
