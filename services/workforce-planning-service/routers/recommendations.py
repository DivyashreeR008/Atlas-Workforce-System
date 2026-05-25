from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Recommendations"])


@router.get("/workforce/hiring-recommendations")
def list_hiring_recommendations(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), department: Optional[str] = None, urgency: Optional[str] = None, status: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_hiring_recommendations(db, x_tenant_id, page, page_size, department, urgency, status)


@router.post("/workforce/hiring-recommendations", status_code=201)
def create_hiring_recommendation(payload: schemas.HiringRecommendationCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_hiring_recommendation(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/hiring-recommendations/{rec_id}")
def get_hiring_recommendation(rec_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_hiring_recommendation(db, rec_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Recommendation not found")
    return result


@router.put("/workforce/hiring-recommendations/{rec_id}")
def update_hiring_recommendation(rec_id: UUID, payload: schemas.HiringRecommendationUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_hiring_recommendation(db, rec_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Recommendation not found")
    return result


@router.delete("/workforce/hiring-recommendations/{rec_id}")
def delete_hiring_recommendation(rec_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_hiring_recommendation(db, rec_id, x_tenant_id):
        raise HTTPException(404, detail="Recommendation not found")
    return schemas.MessageResponse(message="Recommendation deleted")
