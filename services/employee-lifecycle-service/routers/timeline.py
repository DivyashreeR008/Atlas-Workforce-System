from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Employee Timeline"])


@router.get("/lifecycle/timeline/{employee_id}")
def list_timeline(employee_id: str, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_timeline_events(db, x_tenant_id, employee_id, page, page_size)

@router.post("/lifecycle/timeline", status_code=201)
def create_event(payload: schemas.TimelineEventCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_timeline_event(db, x_tenant_id, payload.model_dump(by_alias=True))
