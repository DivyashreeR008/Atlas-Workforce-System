from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Forecasting"])


@router.get("/workforce/forecasts")
def list_forecasts(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), period: Optional[str] = None, department: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_forecasts(db, x_tenant_id, page, page_size, period, department)


@router.post("/workforce/forecasts", status_code=201)
def create_forecast(payload: schemas.WorkforceDemandForecastCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_forecast(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/forecasts/{forecast_id}")
def get_forecast(forecast_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_forecast(db, forecast_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Forecast not found")
    return result


@router.put("/workforce/forecasts/{forecast_id}")
def update_forecast(forecast_id: UUID, payload: schemas.WorkforceDemandForecastUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_forecast(db, forecast_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Forecast not found")
    return result


@router.delete("/workforce/forecasts/{forecast_id}")
def delete_forecast(forecast_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_forecast(db, forecast_id, x_tenant_id):
        raise HTTPException(404, detail="Forecast not found")
    return schemas.MessageResponse(message="Forecast deleted")


@router.get("/workforce/resource-forecasts")
def list_resource_forecasts(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), department: Optional[str] = None, period: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_resource_forecasts(db, x_tenant_id, page, page_size, department, period)


@router.post("/workforce/resource-forecasts", status_code=201)
def create_resource_forecast(payload: schemas.ResourceForecastCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_resource_forecast(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/resource-forecasts/{forecast_id}")
def get_resource_forecast(forecast_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_resource_forecast(db, forecast_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Resource forecast not found")
    return result


@router.put("/workforce/resource-forecasts/{forecast_id}")
def update_resource_forecast(forecast_id: UUID, payload: schemas.ResourceForecastUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_resource_forecast(db, forecast_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Resource forecast not found")
    return result


@router.delete("/workforce/resource-forecasts/{forecast_id}")
def delete_resource_forecast(forecast_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_resource_forecast(db, forecast_id, x_tenant_id):
        raise HTTPException(404, detail="Resource forecast not found")
    return schemas.MessageResponse(message="Resource forecast deleted")


@router.get("/workforce/talent-forecasts")
def list_talent_forecasts(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), role: Optional[str] = None, period: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_talent_forecasts(db, x_tenant_id, page, page_size, role, period)


@router.post("/workforce/talent-forecasts", status_code=201)
def create_talent_forecast(payload: schemas.TalentForecastCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_talent_forecast(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/talent-forecasts/{forecast_id}")
def get_talent_forecast(forecast_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_talent_forecast(db, forecast_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Talent forecast not found")
    return result


@router.put("/workforce/talent-forecasts/{forecast_id}")
def update_talent_forecast(forecast_id: UUID, payload: schemas.TalentForecastUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_talent_forecast(db, forecast_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Talent forecast not found")
    return result


@router.delete("/workforce/talent-forecasts/{forecast_id}")
def delete_talent_forecast(forecast_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_talent_forecast(db, forecast_id, x_tenant_id):
        raise HTTPException(404, detail="Talent forecast not found")
    return schemas.MessageResponse(message="Talent forecast deleted")


@router.get("/workforce/attrition-forecasts")
def list_attrition_forecasts(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), department: Optional[str] = None, period: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_attrition_forecasts(db, x_tenant_id, page, page_size, department, period)


@router.post("/workforce/attrition-forecasts", status_code=201)
def create_attrition_forecast(payload: schemas.AttritionForecastCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_attrition_forecast(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/attrition-forecasts/{forecast_id}")
def get_attrition_forecast(forecast_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_attrition_forecast(db, forecast_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Attrition forecast not found")
    return result


@router.put("/workforce/attrition-forecasts/{forecast_id}")
def update_attrition_forecast(forecast_id: UUID, payload: schemas.AttritionForecastUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_attrition_forecast(db, forecast_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Attrition forecast not found")
    return result


@router.delete("/workforce/attrition-forecasts/{forecast_id}")
def delete_attrition_forecast(forecast_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_attrition_forecast(db, forecast_id, x_tenant_id):
        raise HTTPException(404, detail="Attrition forecast not found")
    return schemas.MessageResponse(message="Attrition forecast deleted")


@router.get("/workforce/retirement-forecasts")
def list_retirement_forecasts(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), department: Optional[str] = None, period: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_retirement_forecasts(db, x_tenant_id, page, page_size, department, period)


@router.post("/workforce/retirement-forecasts", status_code=201)
def create_retirement_forecast(payload: schemas.RetirementForecastCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_retirement_forecast(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/retirement-forecasts/{forecast_id}")
def get_retirement_forecast(forecast_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_retirement_forecast(db, forecast_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Retirement forecast not found")
    return result


@router.put("/workforce/retirement-forecasts/{forecast_id}")
def update_retirement_forecast(forecast_id: UUID, payload: schemas.RetirementForecastUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_retirement_forecast(db, forecast_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Retirement forecast not found")
    return result


@router.delete("/workforce/retirement-forecasts/{forecast_id}")
def delete_retirement_forecast(forecast_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_retirement_forecast(db, forecast_id, x_tenant_id):
        raise HTTPException(404, detail="Retirement forecast not found")
    return schemas.MessageResponse(message="Retirement forecast deleted")
