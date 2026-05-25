from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Onboarding"])


@router.get("/lifecycle/onboarding/templates")
def list_templates(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), is_active: Optional[bool] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_onboarding_templates(db, x_tenant_id, page, page_size, is_active)

@router.post("/lifecycle/onboarding/templates", status_code=201)
def create_template(payload: schemas.OnboardingTemplateCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_onboarding_template(db, x_tenant_id, payload.model_dump())

@router.get("/lifecycle/onboarding/templates/{template_id}")
def get_template(template_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_onboarding_template(db, template_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Template not found")
    return result

@router.put("/lifecycle/onboarding/templates/{template_id}")
def update_template(template_id: UUID, payload: schemas.OnboardingTemplateUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_onboarding_template(db, template_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Template not found")
    return result

@router.delete("/lifecycle/onboarding/templates/{template_id}")
def delete_template(template_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_onboarding_template(db, template_id, x_tenant_id):
        raise HTTPException(404, detail="Template not found")
    return schemas.MessageResponse(message="Template deleted")

@router.get("/lifecycle/onboarding/assignments")
def list_assignments(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), employee_id: Optional[str] = None, status: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_onboarding_assignments(db, x_tenant_id, page, page_size, employee_id, status)

@router.post("/lifecycle/onboarding/assignments", status_code=201)
def create_assignment(payload: schemas.OnboardingAssignmentCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_onboarding_assignment(db, x_tenant_id, payload.model_dump())

@router.get("/lifecycle/onboarding/assignments/{assign_id}")
def get_assignment(assign_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_onboarding_assignment(db, assign_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Assignment not found")
    return result

@router.put("/lifecycle/onboarding/assignments/{assign_id}")
def update_assignment(assign_id: UUID, payload: schemas.OnboardingAssignmentUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_onboarding_assignment(db, assign_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Assignment not found")
    return result

@router.delete("/lifecycle/onboarding/assignments/{assign_id}")
def delete_assignment(assign_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_onboarding_assignment(db, assign_id, x_tenant_id):
        raise HTTPException(404, detail="Assignment not found")
    return schemas.MessageResponse(message="Assignment deleted")
