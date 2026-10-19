from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

import execution
import schemas
from main import get_db

router = APIRouter(tags=["Lifecycle Execution"])

EVENT_TYPES = ("HIRE", "EXIT")


@router.post("/lifecycle/playbooks", status_code=201)
def create_playbook(payload: schemas.PlaybookCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    try:
        return execution.upsert_playbook(
            db, x_tenant_id, payload.name, payload.kind, payload.steps, payload.is_active)
    except ValueError as e:
        raise HTTPException(422, detail=str(e))


@router.get("/lifecycle/playbooks")
def list_playbooks(kind: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    query = db.query(execution.PlaybookDefinition).filter(
        execution.PlaybookDefinition.tenant_id == x_tenant_id)
    if kind:
        query = query.filter(execution.PlaybookDefinition.kind == kind.upper())
    return query.order_by(execution.PlaybookDefinition.created_at.desc()).all()


@router.post("/lifecycle/runs", status_code=201)
def start_run(payload: schemas.LifecycleRunStart, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    unauth_event = payload.event_type is None
    if unauth_event or payload.event_type.upper() not in EVENT_TYPES:
        raise HTTPException(422, detail="event_type must be one of: HIRE, EXIT")
    try:
        run, tasks, created = execution.start_run(
            db, x_tenant_id, payload.employee_id, payload.event_type,
            payload.event_key, payload.playbook_id, payload.trigger_payload)
    except execution.PlaybookNotFoundError as e:
        raise HTTPException(404, detail=str(e))
    except ValueError as e:
        raise HTTPException(422, detail=str(e))
    if not created:
        return {"run": run, "tasks": tasks, "status_code_hint": "existing"}
    return {"run": run, "tasks": tasks, "status_code_hint": "created"}


@router.get("/lifecycle/runs")
def list_runs(employee_id: Optional[str] = None, status: Optional[str] = None,
              page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
              x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    from models import LifecycleRun
    query = db.query(LifecycleRun).filter(LifecycleRun.tenant_id == x_tenant_id)
    if employee_id:
        query = query.filter(LifecycleRun.employee_id == employee_id)
    if status:
        query = query.filter(LifecycleRun.status == status.upper())
    return query.order_by(LifecycleRun.started_at.desc()).offset((page - 1) * page_size).limit(page_size).all()


@router.get("/lifecycle/runs/dashboard")
def run_dashboard(owner: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return execution.run_dashboard(db, x_tenant_id, owner)


@router.get("/lifecycle/runs/{run_id}/audit")
def run_audit(run_id: str, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = execution.run_audit(db, x_tenant_id, run_id)
    if result is None:
        raise HTTPException(404, detail="Run not found")
    return result


@router.post("/lifecycle/runs/escalate-overdue")
def escalate_overdue(x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    escalated = execution.escalate_overdue(db, x_tenant_id)
    return {"escalatedCount": len(escalated),
            "taskIds": [t.id for t in escalated]}


@router.post("/lifecycle/runs/{run_id}/tasks/{task_id}/acknowledge")
def acknowledge_task(run_id: str, task_id: str, payload: schemas.TaskAcknowledgement,
                     x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    try:
        task = execution.acknowledge_task(db, x_tenant_id, run_id, task_id, payload.by, payload.note)
    except ValueError as e:
        raise HTTPException(422, detail=str(e))
    if task is None:
        raise HTTPException(404, detail="Task not found")
    return {"task": task}


@router.get("/lifecycle/runs/{run_id}")
def get_run(run_id: str, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    from models import LifecycleRun, LifecycleRunTask
    run = db.query(LifecycleRun).filter(
        LifecycleRun.tenant_id == x_tenant_id, LifecycleRun.id == run_id).first()
    if run is None:
        raise HTTPException(404, detail="Run not found")
    tasks = db.query(LifecycleRunTask).filter(
        LifecycleRunTask.run_id == run_id).order_by(LifecycleRunTask.step_order).all()
    return {"run": run, "tasks": tasks}
