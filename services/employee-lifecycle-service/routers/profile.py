from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Employee Profile"])


@router.get("/lifecycle/profile/{employee_id}")
def get_profile(employee_id: str, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_employee_profile(db, employee_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Profile not found")
    return result

@router.put("/lifecycle/profile/{employee_id}")
def upsert_profile(employee_id: str, payload: schemas.EmployeeProfileUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.upsert_employee_profile(db, x_tenant_id, employee_id, payload.model_dump(exclude_unset=True))
