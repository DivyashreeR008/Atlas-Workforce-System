from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from main import get_db
import crud

router = APIRouter(tags=["analytics"])


@router.get("/analytics/overview", summary="Pipeline overview stats")
def get_pipeline_overview(
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    return crud.get_pipeline_overview(db, x_tenant_id)


@router.get("/analytics/time-to-hire", summary="Average time to hire")
def get_time_to_hire(
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    return crud.get_time_to_hire(db, x_tenant_id)


@router.get("/analytics/source-effectiveness", summary="Candidate source breakdown")
def get_source_effectiveness(
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    return crud.get_source_effectiveness(db, x_tenant_id)


@router.get("/analytics/conversion-funnel", summary="Application stage conversion rates")
def get_conversion_funnel(
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    return crud.get_conversion_funnel(db, x_tenant_id)
