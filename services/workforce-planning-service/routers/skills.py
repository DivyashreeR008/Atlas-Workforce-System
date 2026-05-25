from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Skills"])


@router.get("/workforce/skill-gaps")
def list_skill_gaps(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), role: Optional[str] = None, period: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_skill_gaps(db, x_tenant_id, page, page_size, role, period)


@router.post("/workforce/skill-gaps", status_code=201)
def create_skill_gap(payload: schemas.SkillGapAnalysisCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_skill_gap(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/skill-gaps/{gap_id}")
def get_skill_gap(gap_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_skill_gap(db, gap_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Skill gap not found")
    return result


@router.put("/workforce/skill-gaps/{gap_id}")
def update_skill_gap(gap_id: UUID, payload: schemas.SkillGapAnalysisUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_skill_gap(db, gap_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Skill gap not found")
    return result


@router.delete("/workforce/skill-gaps/{gap_id}")
def delete_skill_gap(gap_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_skill_gap(db, gap_id, x_tenant_id):
        raise HTTPException(404, detail="Skill gap not found")
    return schemas.MessageResponse(message="Skill gap deleted")
