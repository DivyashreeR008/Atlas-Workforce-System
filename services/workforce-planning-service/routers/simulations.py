from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["Simulations"])


@router.get("/workforce/simulations")
def list_simulations(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), sim_type: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_simulations(db, x_tenant_id, page, page_size, sim_type)


@router.post("/workforce/simulations", status_code=201)
def create_simulation(payload: schemas.WorkforceSimulationCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_simulation(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/simulations/{sim_id}")
def get_simulation(sim_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_simulation(db, sim_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Simulation not found")
    return result


@router.put("/workforce/simulations/{sim_id}")
def update_simulation(sim_id: UUID, payload: schemas.WorkforceSimulationUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_simulation(db, sim_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Simulation not found")
    return result


@router.delete("/workforce/simulations/{sim_id}")
def delete_simulation(sim_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_simulation(db, sim_id, x_tenant_id):
        raise HTTPException(404, detail="Simulation not found")
    return schemas.MessageResponse(message="Simulation deleted")


@router.post("/workforce/simulations/run", status_code=200)
def run_simulation(payload: schemas.SimulationRunRequest, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    results = crud.run_simulation(db, x_tenant_id, payload.simulation_type, payload.parameters)
    sim = crud.create_simulation(db, x_tenant_id, {
        "name": f"{payload.simulation_type} Simulation",
        "simulation_type": payload.simulation_type,
        "parameters": payload.parameters,
        "results": results,
        "status": "COMPLETED",
    })
    return schemas.SimulationRunResponse(simulation_id=sim.id, results=results, summary=f"{payload.simulation_type} simulation completed")


@router.get("/workforce/what-if-analyses")
def list_what_if_analyses(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), simulation_id: Optional[UUID] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_what_if_analyses(db, x_tenant_id, page, page_size, simulation_id)


@router.post("/workforce/what-if-analyses", status_code=201)
def create_what_if_analysis(payload: schemas.WhatIfAnalysisCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_what_if_analysis(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/what-if-analyses/{analysis_id}")
def get_what_if_analysis(analysis_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_what_if_analysis(db, analysis_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Analysis not found")
    return result


@router.put("/workforce/what-if-analyses/{analysis_id}")
def update_what_if_analysis(analysis_id: UUID, payload: schemas.WhatIfAnalysisUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_what_if_analysis(db, analysis_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Analysis not found")
    return result


@router.delete("/workforce/what-if-analyses/{analysis_id}")
def delete_what_if_analysis(analysis_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_what_if_analysis(db, analysis_id, x_tenant_id):
        raise HTTPException(404, detail="Analysis not found")
    return schemas.MessageResponse(message="Analysis deleted")


@router.get("/workforce/org-redesigns")
def list_org_redesigns(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), status: Optional[str] = None, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_org_redesigns(db, x_tenant_id, page, page_size, status)


@router.post("/workforce/org-redesigns", status_code=201)
def create_org_redesign(payload: schemas.OrgRedesignSimulatorCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.create_org_redesign(db, x_tenant_id, payload.model_dump())


@router.get("/workforce/org-redesigns/{redesign_id}")
def get_org_redesign(redesign_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_org_redesign(db, redesign_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Redesign not found")
    return result


@router.put("/workforce/org-redesigns/{redesign_id}")
def update_org_redesign(redesign_id: UUID, payload: schemas.OrgRedesignSimulatorUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_org_redesign(db, redesign_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Redesign not found")
    return result


@router.delete("/workforce/org-redesigns/{redesign_id}")
def delete_org_redesign(redesign_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_org_redesign(db, redesign_id, x_tenant_id):
        raise HTTPException(404, detail="Redesign not found")
    return schemas.MessageResponse(message="Redesign deleted")
