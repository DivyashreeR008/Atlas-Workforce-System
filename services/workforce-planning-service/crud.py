import random
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from models import (
    AttritionForecast, BenchManagement, CapacityPlan, HiringRecommendation,
    OrgRedesignSimulator, ProjectStaffing, ResourceForecast, RetirementForecast,
    SkillGapAnalysis, StrategicPlan, TalentForecast, WhatIfAnalysis,
    WorkforceAllocation, WorkforceDemandForecast, WorkforceSimulation,
)


def _paginate(query, page: int, page_size: int):
    total = query.count()
    items = query.order_by(None).offset((page - 1) * page_size).limit(page_size).all() if total else []
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def _now():
    return datetime.now(timezone.utc)


def get_dashboard_stats(db: Session, tenant_id: str):
    total_headcount = db.query(CapacityPlan.allocated).filter(CapacityPlan.tenant_id == tenant_id).all()
    total_headcount = sum(row[0] for row in total_headcount) if total_headcount else 0
    cap = db.query(CapacityPlan).filter(CapacityPlan.tenant_id == tenant_id)
    total_capacity = sum(c.total_capacity for c in cap.all()) if cap.count() else 0
    total_allocated = sum(c.allocated for c in cap.all()) if cap.count() else 0
    bench_count = db.query(BenchManagement).filter(BenchManagement.tenant_id == tenant_id, BenchManagement.status == "ON_BENCH").count()
    open_reqs = db.query(HiringRecommendation).filter(HiringRecommendation.tenant_id == tenant_id, HiringRecommendation.status == "OPEN").count()
    att = db.query(AttritionForecast).filter(AttritionForecast.tenant_id == tenant_id)
    avg_attrition = sum(a.projected_attrition_rate for a in att.all()) / max(att.count(), 1)
    utilization_rate = round((total_allocated / max(total_capacity, 1)) * 100, 1)
    skill_gap_count = db.query(SkillGapAnalysis).filter(SkillGapAnalysis.tenant_id == tenant_id).count()
    hiring_urgent = db.query(HiringRecommendation).filter(HiringRecommendation.tenant_id == tenant_id, HiringRecommendation.urgency == "HIGH", HiringRecommendation.status == "OPEN").count()

    dept_caps = db.query(CapacityPlan).filter(CapacityPlan.tenant_id == tenant_id).all()
    dept_summary = {}
    for c in dept_caps:
        if c.department not in dept_summary:
            dept_summary[c.department] = {"department": c.department, "total_capacity": 0, "allocated": 0, "open_roles": 0}
        dept_summary[c.department]["total_capacity"] += c.total_capacity
        dept_summary[c.department]["allocated"] += c.allocated

    return {
        "total_headcount": total_headcount,
        "total_capacity": total_capacity,
        "total_allocated": total_allocated,
        "bench_count": bench_count,
        "open_requirements": open_reqs,
        "attrition_rate": round(avg_attrition, 1),
        "utilization_rate": utilization_rate,
        "skill_gap_count": skill_gap_count,
        "hiring_urgent": hiring_urgent,
        "department_summary": list(dept_summary.values()),
        "trends": {},
    }


def list_forecasts(db: Session, tenant_id: str, page: int, page_size: int, period: Optional[str] = None, department: Optional[str] = None):
    q = db.query(WorkforceDemandForecast).filter(WorkforceDemandForecast.tenant_id == tenant_id)
    if period: q = q.filter(WorkforceDemandForecast.period == period)
    if department: q = q.filter(WorkforceDemandForecast.department == department)
    q = q.order_by(WorkforceDemandForecast.period.desc(), WorkforceDemandForecast.department)
    return _paginate(q, page, page_size)


def get_forecast(db: Session, forecast_id: UUID, tenant_id: str):
    return db.query(WorkforceDemandForecast).filter(WorkforceDemandForecast.id == forecast_id, WorkforceDemandForecast.tenant_id == tenant_id).first()


def create_forecast(db: Session, tenant_id: str, data: dict):
    data["gap"] = data.get("projected_headcount", 0) - data.get("current_headcount", 0)
    obj = WorkforceDemandForecast(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_forecast(db: Session, forecast_id: UUID, tenant_id: str, data: dict):
    obj = get_forecast(db, forecast_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.gap = obj.projected_headcount - obj.current_headcount
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_forecast(db: Session, forecast_id: UUID, tenant_id: str) -> bool:
    obj = get_forecast(db, forecast_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def list_capacity_plans(db: Session, tenant_id: str, page: int, page_size: int, period: Optional[str] = None, department: Optional[str] = None):
    q = db.query(CapacityPlan).filter(CapacityPlan.tenant_id == tenant_id)
    if period: q = q.filter(CapacityPlan.period == period)
    if department: q = q.filter(CapacityPlan.department == department)
    q = q.order_by(CapacityPlan.department)
    return _paginate(q, page, page_size)


def get_capacity_plan(db: Session, plan_id: UUID, tenant_id: str):
    return db.query(CapacityPlan).filter(CapacityPlan.id == plan_id, CapacityPlan.tenant_id == tenant_id).first()


def create_capacity_plan(db: Session, tenant_id: str, data: dict):
    data["available"] = data.get("total_capacity", 0) - data.get("allocated", 0)
    data["utilization_rate"] = round((data.get("allocated", 0) / max(data.get("total_capacity", 1), 1)) * 100, 1)
    obj = CapacityPlan(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_capacity_plan(db: Session, plan_id: UUID, tenant_id: str, data: dict):
    obj = get_capacity_plan(db, plan_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.available = obj.total_capacity - obj.allocated
    obj.utilization_rate = round((obj.allocated / max(obj.total_capacity, 1)) * 100, 1)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_capacity_plan(db: Session, plan_id: UUID, tenant_id: str) -> bool:
    obj = get_capacity_plan(db, plan_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def list_allocations(db: Session, tenant_id: str, page: int, page_size: int, department: Optional[str] = None, status: Optional[str] = None):
    q = db.query(WorkforceAllocation).filter(WorkforceAllocation.tenant_id == tenant_id)
    if department: q = q.filter(WorkforceAllocation.department == department)
    if status: q = q.filter(WorkforceAllocation.status == status)
    q = q.order_by(WorkforceAllocation.created_at.desc())
    return _paginate(q, page, page_size)


def get_allocation(db: Session, alloc_id: UUID, tenant_id: str):
    return db.query(WorkforceAllocation).filter(WorkforceAllocation.id == alloc_id, WorkforceAllocation.tenant_id == tenant_id).first()


def create_allocation(db: Session, tenant_id: str, data: dict):
    obj = WorkforceAllocation(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_allocation(db: Session, alloc_id: UUID, tenant_id: str, data: dict):
    obj = get_allocation(db, alloc_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_allocation(db: Session, alloc_id: UUID, tenant_id: str) -> bool:
    obj = get_allocation(db, alloc_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def list_project_staffing(db: Session, tenant_id: str, page: int, page_size: int, department: Optional[str] = None, status: Optional[str] = None):
    q = db.query(ProjectStaffing).filter(ProjectStaffing.tenant_id == tenant_id)
    if department: q = q.filter(ProjectStaffing.department == department)
    if status: q = q.filter(ProjectStaffing.status == status)
    q = q.order_by(ProjectStaffing.created_at.desc())
    return _paginate(q, page, page_size)


def get_project_staffing(db: Session, project_id: UUID, tenant_id: str):
    return db.query(ProjectStaffing).filter(ProjectStaffing.id == project_id, ProjectStaffing.tenant_id == tenant_id).first()


def create_project_staffing(db: Session, tenant_id: str, data: dict):
    obj = ProjectStaffing(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_project_staffing(db: Session, project_id: UUID, tenant_id: str, data: dict):
    obj = get_project_staffing(db, project_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_project_staffing(db: Session, project_id: UUID, tenant_id: str) -> bool:
    obj = get_project_staffing(db, project_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def list_skill_gaps(db: Session, tenant_id: str, page: int, page_size: int, role: Optional[str] = None, period: Optional[str] = None):
    q = db.query(SkillGapAnalysis).filter(SkillGapAnalysis.tenant_id == tenant_id)
    if role: q = q.filter(SkillGapAnalysis.role == role)
    if period: q = q.filter(SkillGapAnalysis.period == period)
    q = q.order_by(SkillGapAnalysis.gap_score.desc())
    return _paginate(q, page, page_size)


def get_skill_gap(db: Session, gap_id: UUID, tenant_id: str):
    return db.query(SkillGapAnalysis).filter(SkillGapAnalysis.id == gap_id, SkillGapAnalysis.tenant_id == tenant_id).first()


def create_skill_gap(db: Session, tenant_id: str, data: dict):
    data["gap_score"] = data.get("required_level", 3) - data.get("current_avg_level", 0)
    obj = SkillGapAnalysis(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_skill_gap(db: Session, gap_id: UUID, tenant_id: str, data: dict):
    obj = get_skill_gap(db, gap_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.gap_score = obj.required_level - obj.current_avg_level
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_skill_gap(db: Session, gap_id: UUID, tenant_id: str) -> bool:
    obj = get_skill_gap(db, gap_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def list_resource_forecasts(db: Session, tenant_id: str, page: int, page_size: int, department: Optional[str] = None, period: Optional[str] = None):
    q = db.query(ResourceForecast).filter(ResourceForecast.tenant_id == tenant_id)
    if department: q = q.filter(ResourceForecast.department == department)
    if period: q = q.filter(ResourceForecast.period == period)
    q = q.order_by(ResourceForecast.period.desc())
    return _paginate(q, page, page_size)


def get_resource_forecast(db: Session, forecast_id: UUID, tenant_id: str):
    return db.query(ResourceForecast).filter(ResourceForecast.id == forecast_id, ResourceForecast.tenant_id == tenant_id).first()


def create_resource_forecast(db: Session, tenant_id: str, data: dict):
    data["net_headcount"] = data.get("current_headcount", 0) + data.get("projected_hires", 0) - data.get("projected_attrition", 0)
    obj = ResourceForecast(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_resource_forecast(db: Session, forecast_id: UUID, tenant_id: str, data: dict):
    obj = get_resource_forecast(db, forecast_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.net_headcount = obj.current_headcount + obj.projected_hires - obj.projected_attrition
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_resource_forecast(db: Session, forecast_id: UUID, tenant_id: str) -> bool:
    obj = get_resource_forecast(db, forecast_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def list_bench(db: Session, tenant_id: str, page: int, page_size: int, department: Optional[str] = None, status: Optional[str] = None):
    q = db.query(BenchManagement).filter(BenchManagement.tenant_id == tenant_id)
    if department: q = q.filter(BenchManagement.department == department)
    if status: q = q.filter(BenchManagement.status == status)
    q = q.order_by(BenchManagement.bench_duration_days.desc())
    return _paginate(q, page, page_size)


def get_bench_employee(db: Session, bench_id: UUID, tenant_id: str):
    return db.query(BenchManagement).filter(BenchManagement.id == bench_id, BenchManagement.tenant_id == tenant_id).first()


def create_bench_employee(db: Session, tenant_id: str, data: dict):
    obj = BenchManagement(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_bench_employee(db: Session, bench_id: UUID, tenant_id: str, data: dict):
    obj = get_bench_employee(db, bench_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_bench_employee(db: Session, bench_id: UUID, tenant_id: str) -> bool:
    obj = get_bench_employee(db, bench_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def list_talent_forecasts(db: Session, tenant_id: str, page: int, page_size: int, role: Optional[str] = None, period: Optional[str] = None):
    q = db.query(TalentForecast).filter(TalentForecast.tenant_id == tenant_id)
    if role: q = q.filter(TalentForecast.role == role)
    if period: q = q.filter(TalentForecast.period == period)
    q = q.order_by(TalentForecast.period.desc())
    return _paginate(q, page, page_size)


def get_talent_forecast(db: Session, forecast_id: UUID, tenant_id: str):
    return db.query(TalentForecast).filter(TalentForecast.id == forecast_id, TalentForecast.tenant_id == tenant_id).first()


def create_talent_forecast(db: Session, tenant_id: str, data: dict):
    data["gap"] = data.get("projected_needs", 0) - data.get("current_talent_pool", 0)
    obj = TalentForecast(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_talent_forecast(db: Session, forecast_id: UUID, tenant_id: str, data: dict):
    obj = get_talent_forecast(db, forecast_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.gap = obj.projected_needs - obj.current_talent_pool
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_talent_forecast(db: Session, forecast_id: UUID, tenant_id: str) -> bool:
    obj = get_talent_forecast(db, forecast_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def list_attrition_forecasts(db: Session, tenant_id: str, page: int, page_size: int, department: Optional[str] = None, period: Optional[str] = None):
    q = db.query(AttritionForecast).filter(AttritionForecast.tenant_id == tenant_id)
    if department: q = q.filter(AttritionForecast.department == department)
    if period: q = q.filter(AttritionForecast.period == period)
    q = q.order_by(AttritionForecast.period.desc())
    return _paginate(q, page, page_size)


def get_attrition_forecast(db: Session, forecast_id: UUID, tenant_id: str):
    return db.query(AttritionForecast).filter(AttritionForecast.id == forecast_id, AttritionForecast.tenant_id == tenant_id).first()


def create_attrition_forecast(db: Session, tenant_id: str, data: dict):
    data["projected_attrition_count"] = int(data.get("current_headcount", 0) * data.get("projected_attrition_rate", 0) / 100)
    obj = AttritionForecast(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_attrition_forecast(db: Session, forecast_id: UUID, tenant_id: str, data: dict):
    obj = get_attrition_forecast(db, forecast_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.projected_attrition_count = int(obj.current_headcount * obj.projected_attrition_rate / 100)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_attrition_forecast(db: Session, forecast_id: UUID, tenant_id: str) -> bool:
    obj = get_attrition_forecast(db, forecast_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def list_retirement_forecasts(db: Session, tenant_id: str, page: int, page_size: int, department: Optional[str] = None, period: Optional[str] = None):
    q = db.query(RetirementForecast).filter(RetirementForecast.tenant_id == tenant_id)
    if department: q = q.filter(RetirementForecast.department == department)
    if period: q = q.filter(RetirementForecast.period == period)
    q = q.order_by(RetirementForecast.period.desc())
    return _paginate(q, page, page_size)


def get_retirement_forecast(db: Session, forecast_id: UUID, tenant_id: str):
    return db.query(RetirementForecast).filter(RetirementForecast.id == forecast_id, RetirementForecast.tenant_id == tenant_id).first()


def create_retirement_forecast(db: Session, tenant_id: str, data: dict):
    obj = RetirementForecast(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_retirement_forecast(db: Session, forecast_id: UUID, tenant_id: str, data: dict):
    obj = get_retirement_forecast(db, forecast_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_retirement_forecast(db: Session, forecast_id: UUID, tenant_id: str) -> bool:
    obj = get_retirement_forecast(db, forecast_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def list_hiring_recommendations(db: Session, tenant_id: str, page: int, page_size: int, department: Optional[str] = None, urgency: Optional[str] = None, status: Optional[str] = None):
    q = db.query(HiringRecommendation).filter(HiringRecommendation.tenant_id == tenant_id)
    if department: q = q.filter(HiringRecommendation.department == department)
    if urgency: q = q.filter(HiringRecommendation.urgency == urgency)
    if status: q = q.filter(HiringRecommendation.status == status)
    q = q.order_by(HiringRecommendation.priority.desc(), HiringRecommendation.current_gap.desc())
    return _paginate(q, page, page_size)


def get_hiring_recommendation(db: Session, rec_id: UUID, tenant_id: str):
    return db.query(HiringRecommendation).filter(HiringRecommendation.id == rec_id, HiringRecommendation.tenant_id == tenant_id).first()


def create_hiring_recommendation(db: Session, tenant_id: str, data: dict):
    obj = HiringRecommendation(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_hiring_recommendation(db: Session, rec_id: UUID, tenant_id: str, data: dict):
    obj = get_hiring_recommendation(db, rec_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_hiring_recommendation(db: Session, rec_id: UUID, tenant_id: str) -> bool:
    obj = get_hiring_recommendation(db, rec_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def list_simulations(db: Session, tenant_id: str, page: int, page_size: int, sim_type: Optional[str] = None):
    q = db.query(WorkforceSimulation).filter(WorkforceSimulation.tenant_id == tenant_id)
    if sim_type: q = q.filter(WorkforceSimulation.simulation_type == sim_type)
    q = q.order_by(WorkforceSimulation.created_at.desc())
    return _paginate(q, page, page_size)


def get_simulation(db: Session, sim_id: UUID, tenant_id: str):
    return db.query(WorkforceSimulation).filter(WorkforceSimulation.id == sim_id, WorkforceSimulation.tenant_id == tenant_id).first()


def create_simulation(db: Session, tenant_id: str, data: dict):
    obj = WorkforceSimulation(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_simulation(db: Session, sim_id: UUID, tenant_id: str, data: dict):
    obj = get_simulation(db, sim_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_simulation(db: Session, sim_id: UUID, tenant_id: str) -> bool:
    obj = get_simulation(db, sim_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def run_simulation(db: Session, tenant_id: str, sim_type: str, parameters: dict):
    if sim_type == "HEADCOUNT":
        current = parameters.get("current_headcount", 100)
        growth_rate = parameters.get("growth_rate", 0.05)
        attrition_rate = parameters.get("attrition_rate", 0.10)
        periods = parameters.get("periods", 4)
        results = []
        for p in range(1, periods + 1):
            hires = int(current * growth_rate * random.uniform(0.8, 1.2))
            leavers = int(current * attrition_rate * random.uniform(0.7, 1.3))
            current = current + hires - leavers
            results.append({"period": p, "headcount": current, "hires": hires, "leavers": leavers})
        return {
            "simulation_type": sim_type,
            "parameters": parameters,
            "results": results,
            "final_headcount": current,
            "total_hires": sum(r["hires"] for r in results),
            "total_leavers": sum(r["leavers"] for r in results),
        }
    elif sim_type == "SKILL_GAP":
        dept = parameters.get("department", "Engineering")
        baseline = parameters.get("baseline_skill_level", 3)
        target = parameters.get("target_skill_level", 4)
        training_impact = parameters.get("training_impact", 0.5)
        hiring_impact = parameters.get("hiring_impact", 0.8)
        periods = parameters.get("periods", 4)
        results = []
        for p in range(1, periods + 1):
            new_level = baseline + (training_impact + hiring_impact) * p * random.uniform(0.8, 1.0)
            results.append({"period": p, "projected_level": round(min(new_level, target), 1), "gap": round(max(target - new_level, 0), 1)})
        return {
            "simulation_type": sim_type,
            "parameters": parameters,
            "results": results,
            "periods_to_close": next((p for p, r in enumerate(results, 1) if r["gap"] <= 0), None),
        }
    elif sim_type == "ATTRITION":
        current = parameters.get("current_headcount", 100)
        base_rate = parameters.get("base_attrition_rate", 0.12)
        intervention_impact = parameters.get("intervention_impact", 0.3)
        periods = parameters.get("periods", 4)
        results = []
        for p in range(1, periods + 1):
            rate = base_rate * max(1 - intervention_impact * (p / periods), 0.3)
            leavers = int(current * rate * random.uniform(0.8, 1.2))
            results.append({"period": p, "headcount": current, "attrition_rate": round(rate, 3), "projected_leavers": leavers})
            current = current - leavers
        return {
            "simulation_type": sim_type,
            "parameters": parameters,
            "results": results,
            "final_headcount": current,
            "avg_retained_rate": round(1 - sum(r["attrition_rate"] for r in results) / periods, 3),
        }
    return {"simulation_type": sim_type, "parameters": parameters, "results": [], "message": "Simulation completed"}


def list_what_if_analyses(db: Session, tenant_id: str, page: int, page_size: int, simulation_id: Optional[UUID] = None):
    q = db.query(WhatIfAnalysis).filter(WhatIfAnalysis.tenant_id == tenant_id)
    if simulation_id: q = q.filter(WhatIfAnalysis.simulation_id == simulation_id)
    q = q.order_by(WhatIfAnalysis.created_at.desc())
    return _paginate(q, page, page_size)


def get_what_if_analysis(db: Session, analysis_id: UUID, tenant_id: str):
    return db.query(WhatIfAnalysis).filter(WhatIfAnalysis.id == analysis_id, WhatIfAnalysis.tenant_id == tenant_id).first()


def create_what_if_analysis(db: Session, tenant_id: str, data: dict):
    sim = db.query(WorkforceSimulation).filter(WorkforceSimulation.id == data["simulation_id"], WorkforceSimulation.tenant_id == tenant_id).first()
    if sim:
        from copy import deepcopy
        base_params = deepcopy(sim.parameters) if sim.parameters else {}
        base_params.update(data.get("assumptions", {}))
        impact = run_simulation(db, tenant_id, sim.simulation_type, base_params)
        data["projected_impact"] = impact
        data["confidence"] = random.uniform(0.6, 0.95)
    obj = WhatIfAnalysis(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_what_if_analysis(db: Session, analysis_id: UUID, tenant_id: str, data: dict):
    obj = get_what_if_analysis(db, analysis_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_what_if_analysis(db: Session, analysis_id: UUID, tenant_id: str) -> bool:
    obj = get_what_if_analysis(db, analysis_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def list_org_redesigns(db: Session, tenant_id: str, page: int, page_size: int, status: Optional[str] = None):
    q = db.query(OrgRedesignSimulator).filter(OrgRedesignSimulator.tenant_id == tenant_id)
    if status: q = q.filter(OrgRedesignSimulator.status == status)
    q = q.order_by(OrgRedesignSimulator.created_at.desc())
    return _paginate(q, page, page_size)


def get_org_redesign(db: Session, redesign_id: UUID, tenant_id: str):
    return db.query(OrgRedesignSimulator).filter(OrgRedesignSimulator.id == redesign_id, OrgRedesignSimulator.tenant_id == tenant_id).first()


def create_org_redesign(db: Session, tenant_id: str, data: dict):
    obj = OrgRedesignSimulator(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_org_redesign(db: Session, redesign_id: UUID, tenant_id: str, data: dict):
    obj = get_org_redesign(db, redesign_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    if data.get("status") == "ANALYZED" and not obj.impact_analysis:
        obj.impact_analysis = _analyze_org_impact(obj.current_structure, obj.proposed_structure)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_org_redesign(db: Session, redesign_id: UUID, tenant_id: str) -> bool:
    obj = get_org_redesign(db, redesign_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


def _analyze_org_impact(current: dict, proposed: dict) -> dict:
    cur_depts = current.get("departments", [])
    prop_depts = proposed.get("departments", [])
    cur_count = len(cur_depts)
    prop_count = len(prop_depts)
    cur_total = sum(d.get("headcount", 0) for d in cur_depts)
    prop_total = sum(d.get("headcount", 0) for d in prop_depts)
    cur_cost = sum(d.get("cost", 0) for d in cur_depts)
    prop_cost = sum(d.get("cost", 0) for d in prop_depts)
    return {
        "current_departments": cur_count,
        "proposed_departments": prop_count,
        "department_change": prop_count - cur_count,
        "current_headcount": cur_total,
        "proposed_headcount": prop_total,
        "headcount_change": prop_total - cur_total,
        "current_cost": cur_cost,
        "proposed_cost": prop_cost,
        "cost_savings": cur_cost - prop_cost,
        "efficiency_score": round(random.uniform(0.6, 0.95), 2),
        "risk_score": round(random.uniform(0.1, 0.4), 2),
    }


def list_strategic_plans(db: Session, tenant_id: str, page: int, page_size: int, status: Optional[str] = None):
    q = db.query(StrategicPlan).filter(StrategicPlan.tenant_id == tenant_id)
    if status: q = q.filter(StrategicPlan.status == status)
    q = q.order_by(StrategicPlan.created_at.desc())
    return _paginate(q, page, page_size)


def get_strategic_plan(db: Session, plan_id: UUID, tenant_id: str):
    return db.query(StrategicPlan).filter(StrategicPlan.id == plan_id, StrategicPlan.tenant_id == tenant_id).first()


def create_strategic_plan(db: Session, tenant_id: str, data: dict):
    obj = StrategicPlan(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


def update_strategic_plan(db: Session, plan_id: UUID, tenant_id: str, data: dict):
    obj = get_strategic_plan(db, plan_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


def delete_strategic_plan(db: Session, plan_id: UUID, tenant_id: str) -> bool:
    obj = get_strategic_plan(db, plan_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True
