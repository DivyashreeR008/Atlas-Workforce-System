from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Probation"])


@router.get("/lifecycle/probation")
def list_records(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), employee_id: Optional[str] = None, status: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_probation_records(db, x_tenant_id, page, page_size, employee_id, status)

@router.post("/lifecycle/probation", status_code=201)
def create_record(payload: schemas.ProbationRecordCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_probation_record(db, x_tenant_id, payload.model_dump())

@router.get("/lifecycle/probation/employee/{employee_id}")
def get_probation_by_employee(employee_id: str, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_probation_by_employee(db, employee_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Probation record not found")
    return result

@router.get("/lifecycle/probation/{record_id}")
def get_record(record_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_probation_record(db, record_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Probation record not found")
    return result

@router.put("/lifecycle/probation/{record_id}")
def update_record(record_id: UUID, payload: schemas.ProbationRecordUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_probation_record(db, record_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Probation record not found")
    return result

@router.get("/lifecycle/probation/{record_id}/assessments")
def list_assessments(record_id: UUID, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_probation_assessments(db, x_tenant_id, record_id, page, page_size)

@router.post("/lifecycle/probation/{record_id}/assessments", status_code=201)
def create_assessment(record_id: UUID, payload: schemas.ProbationAssessmentCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    data = payload.model_dump()
    data["probation_id"] = record_id
    return crud.create_probation_assessment(db, x_tenant_id, data)

@router.put("/lifecycle/probation/assessments/{assess_id}")
def update_assessment(assess_id: UUID, payload: schemas.ProbationAssessmentUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_probation_assessment(db, assess_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Assessment not found")
    return result
