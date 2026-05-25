import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def utcnow():
    return datetime.now(timezone.utc)


class WorkforceDemandForecast(Base):
    __tablename__ = "workforce_demand_forecasts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    department = Column(String(100), nullable=False)
    role = Column(String(200), nullable=False)
    current_headcount = Column(Integer, nullable=False, default=0)
    projected_headcount = Column(Integer, nullable=False, default=0)
    gap = Column(Integer, nullable=False, default=0)
    period = Column(String(20), nullable=False)
    confidence_level = Column(Float, default=0.0)
    factors = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_demand_tenant_period", "tenant_id", "period"),)


class CapacityPlan(Base):
    __tablename__ = "workforce_capacity_plans"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    department = Column(String(100), nullable=False)
    role = Column(String(200), nullable=False)
    total_capacity = Column(Integer, nullable=False, default=0)
    allocated = Column(Integer, nullable=False, default=0)
    available = Column(Integer, nullable=False, default=0)
    utilization_rate = Column(Float, default=0.0)
    period = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_capacity_tenant_period", "tenant_id", "period"),)


class WorkforceAllocation(Base):
    __tablename__ = "workforce_allocations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    employee_id = Column(String(100), nullable=False)
    employee_name = Column(String(200), nullable=False)
    department = Column(String(100))
    role = Column(String(200))
    project_name = Column(String(200), nullable=False)
    allocation_percentage = Column(Integer, nullable=False, default=100)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    status = Column(String(20), nullable=False, default="ACTIVE")
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_alloc_employee", "employee_id"), Index("idx_wf_alloc_project", "project_name"), Index("idx_wf_alloc_tenant", "tenant_id"))


class ProjectStaffing(Base):
    __tablename__ = "workforce_project_staffing"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    project_name = Column(String(200), nullable=False)
    project_code = Column(String(100))
    department = Column(String(100))
    required_roles = Column(JSONB, default=list)
    actual_staffing = Column(JSONB, default=list)
    budget = Column(Float)
    actual_cost = Column(Float)
    status = Column(String(20), nullable=False, default="PLANNED")
    start_date = Column(Date)
    end_date = Column(Date)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_project_tenant", "tenant_id"),)


class SkillGapAnalysis(Base):
    __tablename__ = "workforce_skill_gaps"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    department = Column(String(100))
    role = Column(String(200), nullable=False)
    skill_name = Column(String(200), nullable=False)
    required_level = Column(Integer, nullable=False, default=3)
    current_avg_level = Column(Float, nullable=False, default=0)
    gap_score = Column(Float, nullable=False, default=0)
    employee_count = Column(Integer, default=0)
    priority = Column(String(20), default="MEDIUM")
    period = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_skill_gap_tenant", "tenant_id", "period"),)


class ResourceForecast(Base):
    __tablename__ = "workforce_resource_forecasts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    department = Column(String(100), nullable=False)
    role = Column(String(200), nullable=False)
    current_headcount = Column(Integer, nullable=False, default=0)
    projected_hires = Column(Integer, nullable=False, default=0)
    projected_attrition = Column(Integer, nullable=False, default=0)
    net_headcount = Column(Integer, nullable=False, default=0)
    period = Column(String(20), nullable=False)
    confidence = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_resource_fc_tenant", "tenant_id", "period"),)


class BenchManagement(Base):
    __tablename__ = "workforce_bench"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    employee_id = Column(String(100), nullable=False)
    employee_name = Column(String(200), nullable=False)
    department = Column(String(100))
    role = Column(String(200))
    skills = Column(JSONB, default=list)
    bench_start_date = Column(Date)
    bench_duration_days = Column(Integer, default=0)
    billable_status = Column(String(20), default="NON_BILLABLE")
    status = Column(String(20), nullable=False, default="ON_BENCH")
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_bench_employee", "employee_id"), Index("idx_wf_bench_tenant", "tenant_id"))


class TalentForecast(Base):
    __tablename__ = "workforce_talent_forecasts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    department = Column(String(100))
    role = Column(String(200), nullable=False)
    current_talent_pool = Column(Integer, nullable=False, default=0)
    projected_needs = Column(Integer, nullable=False, default=0)
    gap = Column(Integer, nullable=False, default=0)
    period = Column(String(20), nullable=False)
    risk_level = Column(String(20), default="LOW")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_talent_fc_tenant", "tenant_id", "period"),)


class AttritionForecast(Base):
    __tablename__ = "workforce_attrition_forecasts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    department = Column(String(100))
    role = Column(String(200), nullable=False)
    current_headcount = Column(Integer, nullable=False, default=0)
    projected_attrition_rate = Column(Float, nullable=False, default=0)
    projected_attrition_count = Column(Integer, nullable=False, default=0)
    confidence = Column(Float, default=0.0)
    risk_factors = Column(JSONB, default=dict)
    period = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_attrition_fc_tenant", "tenant_id", "period"),)


class RetirementForecast(Base):
    __tablename__ = "workforce_retirement_forecasts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    department = Column(String(100))
    role = Column(String(200), nullable=False)
    eligible_count = Column(Integer, nullable=False, default=0)
    projected_retirements = Column(Integer, nullable=False, default=0)
    avg_age = Column(Float, default=0.0)
    risk_level = Column(String(20), default="LOW")
    period = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_retire_fc_tenant", "tenant_id", "period"),)


class HiringRecommendation(Base):
    __tablename__ = "workforce_hiring_recommendations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    department = Column(String(100))
    role = Column(String(200), nullable=False)
    priority = Column(String(20), nullable=False, default="MEDIUM")
    recommended_count = Column(Integer, nullable=False, default=1)
    current_gap = Column(Integer, nullable=False, default=0)
    urgency = Column(String(20), default="MEDIUM")
    business_impact = Column(Text)
    justification = Column(Text)
    status = Column(String(20), nullable=False, default="OPEN")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_hiring_rec_tenant", "tenant_id"),)


class WorkforceSimulation(Base):
    __tablename__ = "workforce_simulations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    simulation_type = Column(String(50), nullable=False, default="GENERAL")
    parameters = Column(JSONB, default=dict)
    results = Column(JSONB, default=dict)
    status = Column(String(20), nullable=False, default="DRAFT")
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_sim_tenant", "tenant_id"),)


class WhatIfAnalysis(Base):
    __tablename__ = "workforce_what_if_analyses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    simulation_id = Column(UUID(as_uuid=True), ForeignKey("workforce_simulations.id"))
    scenario_name = Column(String(200), nullable=False)
    assumptions = Column(JSONB, default=dict)
    projected_impact = Column(JSONB, default=dict)
    confidence = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    simulation = relationship("WorkforceSimulation")
    __table_args__ = (Index("idx_wf_whatif_sim", "simulation_id"), Index("idx_wf_whatif_tenant", "tenant_id"))


class OrgRedesignSimulator(Base):
    __tablename__ = "workforce_org_redesigns"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    current_structure = Column(JSONB, default=dict)
    proposed_structure = Column(JSONB, default=dict)
    impact_analysis = Column(JSONB, default=dict)
    status = Column(String(20), nullable=False, default="DRAFT")
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_org_redesign_tenant", "tenant_id"),)


class StrategicPlan(Base):
    __tablename__ = "workforce_strategic_plans"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    period = Column(String(20), nullable=False)
    objectives = Column(JSONB, default=list)
    kpis = Column(JSONB, default=list)
    initiatives = Column(JSONB, default=list)
    status = Column(String(20), nullable=False, default="DRAFT")
    progress = Column(Float, default=0.0)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_wf_strat_plan_tenant", "tenant_id"),)
