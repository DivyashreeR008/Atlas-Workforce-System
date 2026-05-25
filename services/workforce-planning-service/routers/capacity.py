from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Capacity & Staffing"])


@router.get("/workforce/capacity-plans")
def list_capacity_plans(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), period: Optional[str] = None, department: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_capacity_plans(db, x_tenant_id, page, page_size, period, department)


@router.post("/workforce/capacity-plans", status_code=201)
def create_capacity_plan(payload: schemas.CapacityPlanCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_capacity_plan(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/capacity-plans/{plan_id}")
def get_capacity_plan(plan_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_capacity_plan(db, plan_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Capacity plan not found")
    return result


@router.put("/workforce/capacity-plans/{plan_id}")
def update_capacity_plan(plan_id: UUID, payload: schemas.CapacityPlanUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_capacity_plan(db, plan_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Capacity plan not found")
    return result


@router.delete("/workforce/capacity-plans/{plan_id}")
def delete_capacity_plan(plan_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_capacity_plan(db, plan_id, x_tenant_id):
        raise HTTPException(404, detail="Capacity plan not found")
    return schemas.MessageResponse(message="Capacity plan deleted")


@router.get("/workforce/allocations")
def list_allocations(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), department: Optional[str] = None, status: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_allocations(db, x_tenant_id, page, page_size, department, status)


@router.post("/workforce/allocations", status_code=201)
def create_allocation(payload: schemas.WorkforceAllocationCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_allocation(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/allocations/{alloc_id}")
def get_allocation(alloc_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_allocation(db, alloc_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Allocation not found")
    return result


@router.put("/workforce/allocations/{alloc_id}")
def update_allocation(alloc_id: UUID, payload: schemas.WorkforceAllocationUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_allocation(db, alloc_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Allocation not found")
    return result


@router.delete("/workforce/allocations/{alloc_id}")
def delete_allocation(alloc_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_allocation(db, alloc_id, x_tenant_id):
        raise HTTPException(404, detail="Allocation not found")
    return schemas.MessageResponse(message="Allocation deleted")


@router.get("/workforce/project-staffing")
def list_project_staffing(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), department: Optional[str] = None, status: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_project_staffing(db, x_tenant_id, page, page_size, department, status)


@router.post("/workforce/project-staffing", status_code=201)
def create_project_staffing(payload: schemas.ProjectStaffingCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_project_staffing(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/project-staffing/{project_id}")
def get_project_staffing(project_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_project_staffing(db, project_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Project not found")
    return result


@router.put("/workforce/project-staffing/{project_id}")
def update_project_staffing(project_id: UUID, payload: schemas.ProjectStaffingUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_project_staffing(db, project_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Project not found")
    return result


@router.delete("/workforce/project-staffing/{project_id}")
def delete_project_staffing(project_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_project_staffing(db, project_id, x_tenant_id):
        raise HTTPException(404, detail="Project not found")
    return schemas.MessageResponse(message="Project deleted")


@router.get("/workforce/bench")
def list_bench(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), department: Optional[str] = None, status: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_bench(db, x_tenant_id, page, page_size, department, status)


@router.post("/workforce/bench", status_code=201)
def create_bench_employee(payload: schemas.BenchManagementCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_bench_employee(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/bench/{bench_id}")
def get_bench_employee(bench_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_bench_employee(db, bench_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Bench record not found")
    return result


@router.put("/workforce/bench/{bench_id}")
def update_bench_employee(bench_id: UUID, payload: schemas.BenchManagementUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_bench_employee(db, bench_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Bench record not found")
    return result


@router.delete("/workforce/bench/{bench_id}")
def delete_bench_employee(bench_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_bench_employee(db, bench_id, x_tenant_id):
        raise HTTPException(404, detail="Bench record not found")
    return schemas.MessageResponse(message="Bench record deleted")
