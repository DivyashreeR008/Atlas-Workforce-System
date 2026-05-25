from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Career"])


@router.get("/lifecycle/career/frameworks")
def list_frameworks(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_career_frameworks(db, x_tenant_id, page, page_size)

@router.post("/lifecycle/career/frameworks", status_code=201)
def create_framework(payload: schemas.CareerFrameworkCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_career_framework(db, x_tenant_id, payload.model_dump())

@router.get("/lifecycle/career/frameworks/{fw_id}")
def get_framework(fw_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_career_framework(db, fw_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Framework not found")
    return result

@router.put("/lifecycle/career/frameworks/{fw_id}")
def update_framework(fw_id: UUID, payload: schemas.CareerFrameworkUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_career_framework(db, fw_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Framework not found")
    return result

@router.get("/lifecycle/career/job-families")
def list_job_families(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), framework_id: Optional[UUID] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_job_families(db, x_tenant_id, page, page_size, framework_id)

@router.post("/lifecycle/career/job-families", status_code=201)
def create_job_family(payload: schemas.JobFamilyCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_job_family(db, x_tenant_id, payload.model_dump())

@router.get("/lifecycle/career/job-families/{jf_id}")
def get_job_family(jf_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_job_family(db, jf_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Job family not found")
    return result

@router.put("/lifecycle/career/job-families/{jf_id}")
def update_job_family(jf_id: UUID, payload: schemas.JobFamilyUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_job_family(db, jf_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Job family not found")
    return result

@router.get("/lifecycle/career/paths")
def list_career_paths(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), job_family_id: Optional[UUID] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_career_paths(db, x_tenant_id, page, page_size, job_family_id)

@router.post("/lifecycle/career/paths", status_code=201)
def create_career_path(payload: schemas.CareerPathCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_career_path(db, x_tenant_id, payload.model_dump())

@router.get("/lifecycle/career/paths/{path_id}")
def get_career_path(path_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_career_path(db, path_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Career path not found")
    return result

@router.put("/lifecycle/career/paths/{path_id}")
def update_career_path(path_id: UUID, payload: schemas.CareerPathUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_career_path(db, path_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Career path not found")
    return result
