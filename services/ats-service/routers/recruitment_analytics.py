from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from main import get_db
import crud

router = APIRouter(tags=["recruitment-analytics"])


@router.get("/analytics/recruitment", summary="Full recruitment analytics")
def get_recruitment_analytics(
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    return crud.get_recruitment_analytics(db, x_tenant_id)


@router.get("/analytics/hiring-pipeline", summary="Hiring pipeline overview")
def get_hiring_pipeline(
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    return crud.get_hiring_pipeline(db, x_tenant_id)
