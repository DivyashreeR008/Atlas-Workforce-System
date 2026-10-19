"""Engine-level tests for the lifecycle execution engine.

The three engine tables use SQLite-compatible column types, so these tests
run against in-memory SQLite by creating only the engine tables (the rest of
models.py carries dialect-specific JSONB/UUID types the existing suite never
exercises on SQLite).
"""

import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import (
    Base,
    LifecycleRun,
    LifecycleRunTask,
    PlaybookDefinition,
)

ENGINE = create_engine("sqlite://", connect_args={"check_same_thread": False})
MAYBE_SESSION = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)

# Create only the engine tables; the shared Base covers all lifecycle tables,
# and the dialect-specific ones would not compile on SQLite.
Base.metadata.create_all(
    ENGINE,
    tables=[t for t in Base.metadata.sorted_tables
            if t.name in ("lifecycle_playbook_definitions", "lifecycle_runs",
                          "lifecycle_run_tasks")],
)

import execution  # noqa: E402

OFFBOARDING_PLAYBOOK = {
    "name": "standard-exit",
    "kind": "OFFBOARDING",
    "steps": [
        {"name": "revoke-sso", "owner_role": "it-admin", "requires_ack": True,
         "destructive": True, "sla_days": 2},
        {"name": "revoke-db-roles", "owner_role": "dba", "requires_ack": True,
         "dependencies": ["revoke-sso"], "sla_days": 3},
        {"name": "exit-interview", "owner_role": "hr", "sla_days": 0},
    ],
}

ONBOARDING_PLAYBOOK = {
    "name": "standard-hire",
    "kind": "ONBOARDING",
    "steps": [
        {"name": "create-account", "owner_role": "it-admin", "sla_days": 2},
        {"name": "badge-issued", "owner_role": "facilities", "dependencies": ["create-account"],
         "sla_days": 2},
    ],
}


def _db():
    session = MAYBE_SESSION()
    return session


def _fresh_db(*playbooks):
    """Clears the engine tables between tests and seeds the playbooks."""
    session = _db()
    session.query(LifecycleRunTask).delete()
    session.query(LifecycleRun).delete()
    session.query(PlaybookDefinition).delete()
    session.commit()
    for playbook in playbooks:
        execution.upsert_playbook(session, "t1", playbook["name"],
                                  playbook["kind"], playbook["steps"])
    return session


def test_playbook_happy_path_completes_only_with_all_revocation_acks():
    db = _fresh_db(OFFBOARDING_PLAYBOOK)
    run, tasks, created = execution.start_run(db, "t1", "e1", "EXIT")
    assert created is True
    assert run.status == "IN_PROGRESS"
    assert [t.name for t in tasks] == ["revoke-sso", "revoke-db-roles", "exit-interview"]
    # A dependent step is created BLOCKED, not PENDING.
    assert tasks[1].status == "BLOCKED"
    # run stays open while the revocation steps are unacknowledged.
    execution.acknowledge_task(db, "t1", run.id, tasks[2].id, "hr-bob")
    db.expire_all()
    run = db.query(LifecycleRun).filter(LifecycleRun.employee_id == "e1").first()
    assert run.status == "IN_PROGRESS"


def test_revocation_verification_failure_keeps_run_open_and_escalates():
    db = _fresh_db(OFFBOARDING_PLAYBOOK)
    run, tasks, _ = execution.start_run(db, "t1", "e2", "EXIT")
    # The SLA breaches: nobody acknowledged the revocations.
    for t in tasks:
        if t.sla_due is not None:
            t.sla_due = datetime.now(timezone.utc) - timedelta(hours=1)
    db.commit()

    escalated = execution.escalate_overdue(db, "t1")
    assert len(escalated) >= 2

    db.expire_all()
    run = db.query(LifecycleRun).filter(LifecycleRun.employee_id == "e2").first()
    assert run.status == "ESCALATED"
    # ESCALATED is_open: the run is open, not silently completed.
    assert run.status in execution.RUN_OPEN_STATUSES
    assert run.completed_at is None
    dashboard = execution.run_dashboard(db, "t1")
    assert dashboard["tasksEscalated"] >= 2
    assert dashboard["unacknowledgedRevocations"] >= 1


def test_same_event_twice_does_not_duplicate_tasks():
    db = _fresh_db(OFFBOARDING_PLAYBOOK)
    first, first_tasks, created_first = execution.start_run(db, "t1", "e3", "EXIT", event_key="evt-1")
    second, second_tasks, created_second = execution.start_run(db, "t1", "e3", "EXIT", event_key="evt-1")
    assert created_first is True
    assert created_second is False
    assert second.id == first.id
    assert len(second_tasks) == len(first_tasks) == 3
    assert db.query(LifecycleRun).filter(LifecycleRun.employee_id == "e3").count() == 1


def test_full_acknowledgement_completes_the_run():
    db = _fresh_db(OFFBOARDING_PLAYBOOK)
    run, tasks, _ = execution.start_run(db, "t1", "e4", "EXIT")
    names = {t.name: t.id for t in tasks}
    # revoke-sso is destructive: it needs two distinct approvers first.
    execution.acknowledge_task(db, "t1", run.id, names["revoke-sso"], "it-alice")
    execution.acknowledge_task(db, "t1", run.id, names["revoke-sso"], "it-aldo")
    db.expire_all()
    blocked = {t.name: t for t in db.query(LifecycleRunTask).filter(
        LifecycleRunTask.run_id == run.id).all()}
    # Acknowledging the first revocation unblocks the dependent DB-role step.
    assert blocked["revoke-db-roles"].status == "PENDING"
    assert blocked["revoke-sso"].status == "ACKNOWLEDGED"
    execution.acknowledge_task(db, "t1", run.id, blocked["revoke-db-roles"].id, "dba-dave")
    db.expire_all()
    remaining = {t.name: t.id for t in db.query(LifecycleRunTask).filter(
        LifecycleRunTask.run_id == run.id).all()}
    execution.acknowledge_task(db, "t1", run.id, remaining["exit-interview"], "hr-bob")
    db.expire_all()
    run = db.query(LifecycleRun).filter(LifecycleRun.employee_id == "e4").first()
    assert run.status == "COMPLETED"
    assert run.completed_at is not None


def test_destructive_steps_require_two_distinct_approvers():
    db = _fresh_db(OFFBOARDING_PLAYBOOK)
    run, tasks, _ = execution.start_run(db, "t1", "e5", "EXIT")
    revoke_sso = tasks[0]
    execution.acknowledge_task(db, "t1", run.id, revoke_sso.id, "it-alice")
    db.expire_all()
    task = db.query(LifecycleRunTask).filter(
        LifecycleRunTask.id == tasks[0].id).first()
    # Four-eyes: a single approver does not clear a destructive step.
    assert task.status != "ACKNOWLEDGED"
    assert len(task.approvals) == 1
    execution.acknowledge_task(db, "t1", run.id, task.id, "sec-bob")
    db.expire_all()
    task = db.query(LifecycleRunTask).filter(
        LifecycleRunTask.id == tasks[0].id).first()
    assert task.status == "ACKNOWLEDGED"


def test_block_aligns_with_acknowledged_dependencies():
    db = _fresh_db(ONBOARDING_PLAYBOOK)
    run, tasks, _ = execution.start_run(db, "t1", "e6", "HIRE")
    created_account, badge = tasks
    assert badge.status == "BLOCKED"
    execution.acknowledge_task(db, "t1", run.id, created_account.id, "it-alice")
    db.expire_all()
    badge = db.query(LifecycleRunTask).filter(
        LifecycleRunTask.id == badge.id).first()
    assert badge.status == "PENDING"


def test_dashboard_reports_overdue_and_open_state():
    db = _fresh_db(OFFBOARDING_PLAYBOOK)
    run, tasks, _ = execution.start_run(db, "t1", "e7", "EXIT")
    dashboard_before = execution.run_dashboard(db, "t1", owner="it-admin")
    assert dashboard_before["runsOpen"] == 1
    assert dashboard_before["myTasks"]  # it-admin owns revoke-sso

    overdue_task = next(t for t in tasks if t.sla_due is not None)
    overdue_task.sla_due = datetime.now(timezone.utc) - timedelta(days=1)
    db.commit()
    execution.escalate_overdue(db, "t1")
    db.expire_all()
    dashboard = execution.run_dashboard(db, "t1")
    assert dashboard["tasksOverdue"] >= 1
    assert dashboard["runsEscalated"] == 1
    assert dashboard["runsCompleted"] == 0


def test_hire_events_need_an_onboarding_playbook():
    db = _fresh_db(ONBOARDING_PLAYBOOK, OFFBOARDING_PLAYBOOK)
    run, tasks, _ = execution.start_run(db, "t1", "e8", "HIRE")
    assert [t.name for t in tasks] == ["create-account", "badge-issued"]
    raised = False
    try:
        execution.start_run(db, "t1", "e9", "EXIT", playbook_id="no-such")
    except execution.PlaybookNotFoundError:
        raised = True
    assert raised is True
