from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Employee Achievements"])


@router.get("/lifecycle/achievements/{employee_id}")
def list_achievements(employee_id: str, category: Optional[str] = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_employee_achievements(db, x_tenant_id, employee_id, category, page, page_size)

@router.post("/lifecycle/achievements", status_code=201)
def create_achievement(payload: schemas.EmployeeAchievementCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_employee_achievement(db, x_tenant_id, payload.model_dump())

@router.put("/lifecycle/achievements/{ach_id}")
def update_achievement(ach_id: UUID, payload: schemas.EmployeeAchievementUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_employee_achievement(db, ach_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Achievement not found")
    return result

@router.delete("/lifecycle/achievements/{ach_id}")
def delete_achievement(ach_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_employee_achievement(db, ach_id, x_tenant_id):
        raise HTTPException(404, detail="Achievement not found")
    return schemas.MessageResponse(message="Achievement deleted")
