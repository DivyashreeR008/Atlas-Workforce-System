from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Internal Mobility"])


@router.get("/lifecycle/mobility/jobs")
def list_jobs(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), status: Optional[str] = None, department: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_internal_jobs(db, x_tenant_id, page, page_size, status, department)

@router.post("/lifecycle/mobility/jobs", status_code=201)
def create_job(payload: schemas.InternalJobPostingCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_internal_job(db, x_tenant_id, payload.model_dump())

@router.get("/lifecycle/mobility/jobs/{job_id}")
def get_job(job_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_internal_job(db, job_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Job not found")
    return result

@router.put("/lifecycle/mobility/jobs/{job_id}")
def update_job(job_id: UUID, payload: schemas.InternalJobPostingUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_internal_job(db, job_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Job not found")
    return result

@router.delete("/lifecycle/mobility/jobs/{job_id}")
def delete_job(job_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_internal_job(db, job_id, x_tenant_id):
        raise HTTPException(404, detail="Job not found")
    return schemas.MessageResponse(message="Job deleted")

@router.get("/lifecycle/mobility/applications")
def list_applications(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), job_id: Optional[UUID] = None, employee_id: Optional[str] = None, status: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_internal_applications(db, x_tenant_id, page, page_size, job_id, employee_id, status)

@router.post("/lifecycle/mobility/applications", status_code=201)
def create_application(payload: schemas.InternalApplicationCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_internal_application(db, x_tenant_id, payload.model_dump())

@router.put("/lifecycle/mobility/applications/{app_id}")
def update_application(app_id: UUID, payload: schemas.InternalApplicationUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_internal_application(db, app_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Application not found")
    return result

@router.get("/lifecycle/mobility/transfers")
def list_transfers(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), employee_id: Optional[str] = None, status: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_transfer_requests(db, x_tenant_id, page, page_size, employee_id, status)

@router.post("/lifecycle/mobility/transfers", status_code=201)
def create_transfer(payload: schemas.TransferRequestCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_transfer_request(db, x_tenant_id, payload.model_dump())

@router.get("/lifecycle/mobility/transfers/{transfer_id}")
def get_transfer(transfer_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_transfer_request(db, transfer_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Transfer request not found")
    return result

@router.put("/lifecycle/mobility/transfers/{transfer_id}")
def update_transfer(transfer_id: UUID, payload: schemas.TransferRequestUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_transfer_request(db, transfer_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Transfer request not found")
    return result
