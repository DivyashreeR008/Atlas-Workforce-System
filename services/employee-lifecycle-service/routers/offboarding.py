from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Offboarding"])


@router.get("/lifecycle/offboarding")
def list_records(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), employee_id: Optional[str] = None, status: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_offboarding_records(db, x_tenant_id, page, page_size, employee_id, status)

@router.post("/lifecycle/offboarding", status_code=201)
def create_record(payload: schemas.OffboardingRecordCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_offboarding_record(db, x_tenant_id, payload.model_dump())

@router.get("/lifecycle/offboarding/{record_id}")
def get_record(record_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_offboarding_record(db, record_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Offboarding record not found")
    return result

@router.put("/lifecycle/offboarding/{record_id}")
def update_record(record_id: UUID, payload: schemas.OffboardingRecordUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_offboarding_record(db, record_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Offboarding record not found")
    return result

@router.post("/lifecycle/offboarding/{record_id}/exit-interview", status_code=201)
def create_exit_interview(record_id: UUID, payload: schemas.ExitInterviewCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    data = payload.model_dump()
    data["offboarding_id"] = record_id
    return crud.create_exit_interview(db, x_tenant_id, data)

@router.get("/lifecycle/offboarding/{record_id}/exit-interview")
def get_exit_interview(record_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_exit_interview_by_offboarding(db, record_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Exit interview not found")
    return result
