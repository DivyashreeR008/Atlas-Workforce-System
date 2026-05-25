from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Promotions"])


@router.get("/lifecycle/promotions")
def list_promotions(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), employee_id: Optional[str] = None, status: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_promotion_requests(db, x_tenant_id, page, page_size, employee_id, status)

@router.post("/lifecycle/promotions", status_code=201)
def create_promotion(payload: schemas.PromotionRequestCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_promotion_request(db, x_tenant_id, payload.model_dump())

@router.get("/lifecycle/promotions/{promo_id}")
def get_promotion(promo_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_promotion_request(db, promo_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Promotion request not found")
    return result

@router.put("/lifecycle/promotions/{promo_id}")
def update_promotion(promo_id: UUID, payload: schemas.PromotionRequestUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_promotion_request(db, promo_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Promotion request not found")
    return result
