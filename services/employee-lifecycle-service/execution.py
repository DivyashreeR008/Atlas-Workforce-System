"""Lifecycle execution engine.

Turns employee events (HIRE, EXIT) into playbook runs with ordered tasks.
Security-critical rule: an offboarding revocation step (requires_ack) keeps
the run open until the owning system acknowledges it; breach of the SLA
escalates but never silently closes the run. The (tenant, employee,
event_type, event_key) identity makes event re-delivery idempotent.
"""

import logging
from datetime import datetime, timedelta, timezone

from models import LifecycleRun, LifecycleRunTask, PlaybookDefinition

logger = logging.getLogger("employee-lifecycle-service")

EVENT_TO_KIND = {"HIRE": "ONBOARDING", "EXIT": "OFFBOARDING"}

RUN_OPEN_STATUSES = ("IN_PROGRESS", "ESCALATED")
TASK_STATUSES = ("BLOCKED", "PENDING", "ACKNOWLEDGED")


class PlaybookNotFoundError(LookupError):
    pass


def _now():
    return datetime.now(timezone.utc)


def _as_utc(dt):
    """SQLite-backed columns lose tzinfo; treat stored naive values as UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def start_run(db, tenant_id, employee_id, event_type, event_key=None,
              playbook_id=None, trigger_payload=None):
    """Creates a run for the event, idempotently. A duplicate event (same
    tenant, employee, event type and key) returns the existing run and its
    tasks without creating anything."""
    normalized_event = (event_type or "").strip().upper()
    if normalized_event not in EVENT_TO_KIND:
        raise ValueError("event_type must be one of: HIRE, EXIT")
    kind = EVENT_TO_KIND[normalized_event]

    normalized_key = event_key if event_key else str(employee_id)
    existing = db.query(LifecycleRun).filter(
        LifecycleRun.tenant_id == tenant_id,
        LifecycleRun.employee_id == employee_id,
        LifecycleRun.event_type == normalized_event,
        LifecycleRun.event_key == normalized_key,
    ).first()
    if existing is not None:
        return existing, db.query(LifecycleRunTask).filter(
            LifecycleRunTask.run_id == existing.id).all(), False

    playbook = _resolve_playbook(db, tenant_id, kind, playbook_id)
    run = LifecycleRun(
        tenant_id=tenant_id,
        employee_id=employee_id,
        event_type=normalized_event,
        event_key=normalized_key,
        playbook_id=playbook["id"],
        status="IN_PROGRESS",
        trigger_payload=trigger_payload or {},
        started_at=_now(),
    )
    db.add(run)
    db.flush()

    for task in instantiate_steps(db, tenant_id, employee_id, run, playbook["steps"]):
        db.add(task)
    db.commit()
    db.refresh(run)
    tasks = db.query(LifecycleRunTask).filter(
        LifecycleRunTask.run_id == run.id).order_by(LifecycleRunTask.step_order).all()
    return run, tasks, True


def _resolve_playbook(db, tenant_id, kind, playbook_id):
    if playbook_id:
        playbook = db.query(PlaybookDefinition).filter(
            PlaybookDefinition.tenant_id == tenant_id,
            PlaybookDefinition.id == playbook_id,
        ).first()
    else:
        playbook = db.query(PlaybookDefinition).filter(
            PlaybookDefinition.tenant_id == tenant_id,
            PlaybookDefinition.kind == kind,
            PlaybookDefinition.is_active.is_(True),
        ).order_by(PlaybookDefinition.created_at.desc()).first()
    if playbook is None:
        raise PlaybookNotFoundError("No playbook configured for kind " + kind)
    return {
        "id": playbook.id,
        "steps": playbook.steps or [],
    }


def instantiate_steps(db, tenant_id, employee_id, run, steps):
    """Creates one task per ordered step. Dependencies are task names in the
    ordered list; each task is BLOCKED until every dependency is acknowledged."""
    now = _now()
    tasks = []
    for index, step in enumerate(steps):
        name = str(step.get("name", "")).strip()
        if not name:
            raise ValueError("Every playbook step needs a name")
        sla_days = int(step.get("sla_days") or 0)
        deps = list(step.get("dependencies") or [])
        task = LifecycleRunTask(
            run_id=run.id,
            tenant_id=tenant_id,
            employee_id=employee_id,
            step_order=index,
            name=name,
            owner_role=str(step.get("owner_role") or "hr"),
            requires_ack=bool(step.get("requires_ack", False)),
            destructive=bool(step.get("destructive", False)),
            sla_days=sla_days,
            sla_due=now + timedelta(days=sla_days) if sla_days else None,
            dependencies=deps,
            approvals=[],
        )
        if deps and not _all_acked(tasks, deps):
            task.status = "BLOCKED"
        else:
            task.status = "PENDING"
        tasks.append(task)
    return tasks


def _all_acked(tasks, dependency_names):
    known_ack_names = {t.name for t in tasks if t.status == "ACKNOWLEDGED"}
    return all(name in known_ack_names for name in dependency_names)


def acknowledge_task(db, tenant_id, run_id, task_id, acknowledged_by, note=None):
    """Acknowledges one task instance. Destructive steps use the four-eyes
    pattern: two distinct acknowledgers are required before the step clears."""
    task = db.query(LifecycleRunTask).filter(
        LifecycleRunTask.tenant_id == tenant_id,
        LifecycleRunTask.run_id == run_id,
        LifecycleRunTask.id == task_id,
    ).first()
    if task is None:
        return None
    if task.status == "ACKNOWLEDGED":
        return task
    if task.status == "BLOCKED":
        raise ValueError("Task " + task.name + " is blocked by unacknowledged dependencies")
    if not acknowledged_by or not str(acknowledged_by).strip():
        raise ValueError("acknowledged_by is required")

    approvals = list(task.approvals or [])
    approvals.append({"by": str(acknowledged_by).strip(), "at": _now().isoformat(), "note": note or ""})
    task.approvals = approvals
    task.updated_at = _now()

    if task.destructive and len({a["by"] for a in approvals}) < 2:
        db.commit()
        db.refresh(task)
        return task

    task.status = "ACKNOWLEDGED"
    task.acknowledged_at = _now()
    _unblock_dependents(db, task)
    _maybe_complete_run(db, task.run_id)
    db.commit()
    db.refresh(task)
    return task


def _unblock_dependents(db, task):
    if task.status != "ACKNOWLEDGED":
        return
    run_tasks = db.query(LifecycleRunTask).filter(
        LifecycleRunTask.run_id == task.run_id).all()
    for other in run_tasks:
        if other.status != "BLOCKED":
            continue
        if set(other.dependencies or []) <= {t.name for t in run_tasks if t.status == "ACKNOWLEDGED"}:
            other.status = "PENDING"


def _maybe_complete_run(db, run_id):
    run = db.query(LifecycleRun).filter(LifecycleRun.id == run_id).first()
    if run is None or run.status not in RUN_OPEN_STATUSES:
        return
    tasks = db.query(LifecycleRunTask).filter(LifecycleRunTask.run_id == run_id).all()
    if not tasks:
        return
    if all(t.status == "ACKNOWLEDGED" for t in tasks):
        run.status = "COMPLETED"
        run.completed_at = _now()
    # A run with unacknowledged revocation steps stays open - it is never
    # closed by anything other than full acknowledgment.


def escalate_overdue(db, tenant_id):
    """Marks overdue unacknowledged tasks escalated and flags their runs
    ESCALATED - which is still an open state, not a completed one. Returns
    the tasks that were escalated."""
    due_cutoff = _now()
    escalated = []
    overdue_tasks = db.query(LifecycleRunTask).filter(
        LifecycleRunTask.tenant_id == tenant_id,
        LifecycleRunTask.status.in_(("PENDING", "BLOCKED")),
        LifecycleRunTask.escalated.is_(False),
        LifecycleRunTask.sla_due.isnot(None),
        LifecycleRunTask.sla_due < due_cutoff,
    ).all()
    for task in overdue_tasks:
        task.escalated = True
        escalated.append(task)
        run = db.query(LifecycleRun).filter(
            LifecycleRun.tenant_id == tenant_id,
            LifecycleRun.id == task.run_id,
        ).first()
        if run is not None and run.status == "IN_PROGRESS":
            run.status = "ESCALATED"
    if escalated:
        db.commit()
        logger.info("lifecycle.escalated_overdue_tasks", extra={"count": len(escalated),
                                                                "tenant_id": tenant_id})
    return escalated


def run_dashboard(db, tenant_id, owner=None):
    """Dashboard state: open, escalated and completed runs, overdue tasks,
    and the owner's open tasks when requested."""
    runs = db.query(LifecycleRun).filter(LifecycleRun.tenant_id == tenant_id).all()
    tasks = db.query(LifecycleRunTask).filter(LifecycleRunTask.tenant_id == tenant_id).all()
    now = _now()

    open_runs = [r for r in runs if r.status in RUN_OPEN_STATUSES]
    completed_runs = [r for r in runs if r.status == "COMPLETED"]
    overdue = [t for t in tasks
               if t.status in ("PENDING", "BLOCKED")
               and t.sla_due is not None
               and _as_utc(t.sla_due) < now
               and str(t.created_at) != ""]
    escalations = [t for t in tasks if t.escalated]
    if owner:
        my_tasks = [t for t in tasks
                    if t.owner_role == owner and t.status in ("PENDING", "BLOCKED")]
    else:
        my_tasks = []

    # Completion audit: how many open runs are held open only by an
    # unacknowledged revocation step.
    unacked_revocations = [t for t in tasks
                           if t.requires_ack and t.status != "ACKNOWLEDGED"]

    return {
        "runsTotal": len(runs),
        "runsOpen": len(open_runs),
        "runsCompleted": len(completed_runs),
        "runsEscalated": len([r for r in runs if r.status == "ESCALATED"]),
        "tasksOverdue": len(overdue),
        "tasksEscalated": len(escalations),
        "unacknowledgedRevocations": len(unacked_revocations),
        "myTasks": my_tasks,
    }


def run_audit(db, tenant_id, run_id):
    """Per-run completion audit: the run's state plus every task, ordered,
    with acknowledgement and escalation state. Returns None for a missing run."""
    run = db.query(LifecycleRun).filter(
        LifecycleRun.tenant_id == tenant_id,
        LifecycleRun.id == run_id,
    ).first()
    if run is None:
        return None
    tasks = db.query(LifecycleRunTask).filter(
        LifecycleRunTask.run_id == run_id).order_by(LifecycleRunTask.step_order).all()
    return {
        "run": {
            "id": run.id,
            "employeeId": run.employee_id,
            "eventType": run.event_type,
            "status": run.status,
            "startedAt": run.started_at,
            "completedAt": run.completed_at,
        },
        "tasks": [{
            "name": t.name,
            "status": t.status,
            "ownerRole": t.owner_role,
            "requiresAck": t.requires_ack,
            "destructive": t.destructive,
            "approvals": t.approvals,
            "escalated": t.escalated,
            "slaDue": t.sla_due,
        } for t in tasks],
    }


def upsert_playbook(db, tenant_id, name, kind, steps, is_active=True):
    normalized_kind = (kind or "").strip().upper()
    if normalized_kind not in EVENT_TO_KIND.values():
        raise ValueError("kind must be one of: ONBOARDING, OFFBOARDING")
    if not steps:
        raise ValueError("A playbook needs at least one step")
    playbook = PlaybookDefinition(
        tenant_id=tenant_id,
        name=name,
        kind=normalized_kind,
        steps=steps,
        is_active=is_active,
    )
    db.add(playbook)
    db.commit()
    db.refresh(playbook)
    return playbook
