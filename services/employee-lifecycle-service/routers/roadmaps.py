from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Career Roadmaps"])


@router.get("/lifecycle/career/roadmaps")
def list_roadmaps(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), employee_id: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_career_roadmaps(db, x_tenant_id, employee_id, page, page_size)

@router.post("/lifecycle/career/roadmaps", status_code=201)
def create_roadmap(payload: schemas.CareerRoadmapCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_career_roadmap(db, x_tenant_id, payload.model_dump())

@router.get("/lifecycle/career/roadmaps/{roadmap_id}")
def get_roadmap(roadmap_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_career_roadmap(db, roadmap_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Roadmap not found")
    return result

@router.put("/lifecycle/career/roadmaps/{roadmap_id}")
def update_roadmap(roadmap_id: UUID, payload: schemas.CareerRoadmapUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_career_roadmap(db, roadmap_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Roadmap not found")
    return result
