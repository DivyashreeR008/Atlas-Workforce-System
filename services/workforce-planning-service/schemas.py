from datetime import date, datetime
from typing import Any, Generic, Optional, TypeVar
from uuid import UUID
from pydantic import BaseModel, Field

T = TypeVar("T")


class MessageResponse(BaseModel):
    message: str


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class DashboardResponse(BaseModel):
    total_headcount: int
    total_capacity: int
    total_allocated: int
    bench_count: int
    open_requirements: int
    attrition_rate: float
    utilization_rate: float
    skill_gap_count: int
    hiring_urgent: int
    department_summary: list[dict]
    trends: dict


class WorkforceDemandForecastCreate(BaseModel):
    department: str = Field(..., max_length=100)
    role: str = Field(..., max_length=200)
    current_headcount: int = 0
    projected_headcount: int = 0
    period: str = Field(..., max_length=20)
    confidence_level: float = 0.0
    factors: dict = Field(default_factory=dict)


class WorkforceDemandForecastUpdate(BaseModel):
    current_headcount: Optional[int] = None
    projected_headcount: Optional[int] = None
    confidence_level: Optional[float] = None
    factors: Optional[dict] = None


class WorkforceDemandForecastResponse(BaseModel):
    id: UUID; tenant_id: str; department: str; role: str
    current_headcount: int; projected_headcount: int; gap: int
    period: str; confidence_level: float; factors: dict[Any, Any]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class CapacityPlanCreate(BaseModel):
    department: str = Field(..., max_length=100)
    role: str = Field(..., max_length=200)
    total_capacity: int = 0
    allocated: int = 0
    period: str = Field(..., max_length=20)


class CapacityPlanUpdate(BaseModel):
    total_capacity: Optional[int] = None
    allocated: Optional[int] = None
    available: Optional[int] = None
    utilization_rate: Optional[float] = None


class CapacityPlanResponse(BaseModel):
    id: UUID; tenant_id: str; department: str; role: str
    total_capacity: int; allocated: int; available: int
    utilization_rate: float; period: str
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class WorkforceAllocationCreate(BaseModel):
    employee_id: str = Field(..., max_length=100)
    employee_name: str = Field(..., max_length=200)
    department: Optional[str] = None
    role: Optional[str] = None
    project_name: str = Field(..., max_length=200)
    allocation_percentage: int = 100
    start_date: date
    end_date: Optional[date] = None
    notes: Optional[str] = None


class WorkforceAllocationUpdate(BaseModel):
    allocation_percentage: Optional[int] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class WorkforceAllocationResponse(BaseModel):
    id: UUID; tenant_id: str; employee_id: str; employee_name: str
    department: Optional[str]; role: Optional[str]
    project_name: str; allocation_percentage: int
    start_date: date; end_date: Optional[date]
    status: str; notes: Optional[str]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class ProjectStaffingCreate(BaseModel):
    project_name: str = Field(..., max_length=200)
    project_code: Optional[str] = None
    department: Optional[str] = None
    required_roles: list[dict] = Field(default_factory=list)
    actual_staffing: list[dict] = Field(default_factory=list)
    budget: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ProjectStaffingUpdate(BaseModel):
    required_roles: Optional[list[dict]] = None
    actual_staffing: Optional[list[dict]] = None
    budget: Optional[float] = None
    actual_cost: Optional[float] = None
    status: Optional[str] = None
    end_date: Optional[date] = None


class ProjectStaffingResponse(BaseModel):
    id: UUID; tenant_id: str; project_name: str
    project_code: Optional[str]; department: Optional[str]
    required_roles: list[Any]; actual_staffing: list[Any]
    budget: Optional[float]; actual_cost: Optional[float]
    status: str; start_date: Optional[date]; end_date: Optional[date]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class SkillGapAnalysisCreate(BaseModel):
    department: Optional[str] = None
    role: str = Field(..., max_length=200)
    skill_name: str = Field(..., max_length=200)
    required_level: int = 3
    current_avg_level: float = 0
    employee_count: int = 0
    priority: str = "MEDIUM"
    period: str = Field(..., max_length=20)


class SkillGapAnalysisUpdate(BaseModel):
    current_avg_level: Optional[float] = None
    gap_score: Optional[float] = None
    employee_count: Optional[int] = None
    priority: Optional[str] = None


class SkillGapAnalysisResponse(BaseModel):
    id: UUID; tenant_id: str; department: Optional[str]; role: str
    skill_name: str; required_level: int; current_avg_level: float
    gap_score: float; employee_count: int; priority: str; period: str
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class ResourceForecastCreate(BaseModel):
    department: str = Field(..., max_length=100)
    role: str = Field(..., max_length=200)
    current_headcount: int = 0
    projected_hires: int = 0
    projected_attrition: int = 0
    period: str = Field(..., max_length=20)
    confidence: float = 0.0


class ResourceForecastUpdate(BaseModel):
    projected_hires: Optional[int] = None
    projected_attrition: Optional[int] = None
    confidence: Optional[float] = None


class ResourceForecastResponse(BaseModel):
    id: UUID; tenant_id: str; department: str; role: str
    current_headcount: int; projected_hires: int
    projected_attrition: int; net_headcount: int
    period: str; confidence: float
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class BenchManagementCreate(BaseModel):
    employee_id: str = Field(..., max_length=100)
    employee_name: str = Field(..., max_length=200)
    department: Optional[str] = None
    role: Optional[str] = None
    skills: list[dict] = Field(default_factory=list)
    bench_start_date: Optional[date] = None
    notes: Optional[str] = None


class BenchManagementUpdate(BaseModel):
    role: Optional[str] = None
    skills: Optional[list[dict]] = None
    billable_status: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class BenchManagementResponse(BaseModel):
    id: UUID; tenant_id: str; employee_id: str; employee_name: str
    department: Optional[str]; role: Optional[str]
    skills: list[Any]; bench_start_date: Optional[date]
    bench_duration_days: int; billable_status: str; status: str
    notes: Optional[str]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class TalentForecastCreate(BaseModel):
    department: Optional[str] = None
    role: str = Field(..., max_length=200)
    current_talent_pool: int = 0
    projected_needs: int = 0
    period: str = Field(..., max_length=20)
    risk_level: str = "LOW"


class TalentForecastUpdate(BaseModel):
    current_talent_pool: Optional[int] = None
    projected_needs: Optional[int] = None
    risk_level: Optional[str] = None


class TalentForecastResponse(BaseModel):
    id: UUID; tenant_id: str; department: Optional[str]; role: str
    current_talent_pool: int; projected_needs: int; gap: int
    period: str; risk_level: str
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class AttritionForecastCreate(BaseModel):
    department: Optional[str] = None
    role: str = Field(..., max_length=200)
    current_headcount: int = 0
    projected_attrition_rate: float = 0
    confidence: float = 0.0
    risk_factors: dict = Field(default_factory=dict)
    period: str = Field(..., max_length=20)


class AttritionForecastUpdate(BaseModel):
    projected_attrition_rate: Optional[float] = None
    confidence: Optional[float] = None
    risk_factors: Optional[dict] = None


class AttritionForecastResponse(BaseModel):
    id: UUID; tenant_id: str; department: Optional[str]; role: str
    current_headcount: int; projected_attrition_rate: float
    projected_attrition_count: int; confidence: float
    risk_factors: dict[Any, Any]; period: str
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class RetirementForecastCreate(BaseModel):
    department: Optional[str] = None
    role: str = Field(..., max_length=200)
    eligible_count: int = 0
    projected_retirements: int = 0
    avg_age: float = 0.0
    risk_level: str = "LOW"
    period: str = Field(..., max_length=20)


class RetirementForecastUpdate(BaseModel):
    eligible_count: Optional[int] = None
    projected_retirements: Optional[int] = None
    avg_age: Optional[float] = None
    risk_level: Optional[str] = None


class RetirementForecastResponse(BaseModel):
    id: UUID; tenant_id: str; department: Optional[str]; role: str
    eligible_count: int; projected_retirements: int
    avg_age: float; risk_level: str; period: str
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class HiringRecommendationCreate(BaseModel):
    department: Optional[str] = None
    role: str = Field(..., max_length=200)
    priority: str = "MEDIUM"
    recommended_count: int = 1
    current_gap: int = 0
    urgency: str = "MEDIUM"
    business_impact: Optional[str] = None
    justification: Optional[str] = None


class HiringRecommendationUpdate(BaseModel):
    priority: Optional[str] = None
    recommended_count: Optional[int] = None
    current_gap: Optional[int] = None
    urgency: Optional[str] = None
    business_impact: Optional[str] = None
    justification: Optional[str] = None
    status: Optional[str] = None


class HiringRecommendationResponse(BaseModel):
    id: UUID; tenant_id: str; department: Optional[str]; role: str
    priority: str; recommended_count: int; current_gap: int
    urgency: str; business_impact: Optional[str]
    justification: Optional[str]; status: str
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class WorkforceSimulationCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    simulation_type: str = "GENERAL"
    parameters: dict = Field(default_factory=dict)
    created_by: Optional[str] = None


class WorkforceSimulationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parameters: Optional[dict] = None
    results: Optional[dict] = None
    status: Optional[str] = None


class WorkforceSimulationResponse(BaseModel):
    id: UUID; tenant_id: str; name: str; description: Optional[str]
    simulation_type: str; parameters: dict[Any, Any]
    results: dict[Any, Any]; status: str
    created_by: Optional[str]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class WhatIfAnalysisCreate(BaseModel):
    simulation_id: UUID
    scenario_name: str = Field(..., max_length=200)
    assumptions: dict = Field(default_factory=dict)


class WhatIfAnalysisUpdate(BaseModel):
    assumptions: Optional[dict] = None
    projected_impact: Optional[dict] = None
    confidence: Optional[float] = None


class WhatIfAnalysisResponse(BaseModel):
    id: UUID; tenant_id: str; simulation_id: Optional[UUID]
    scenario_name: str; assumptions: dict[Any, Any]
    projected_impact: dict[Any, Any]; confidence: float
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class OrgRedesignSimulatorCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    current_structure: dict = Field(default_factory=dict)
    proposed_structure: dict = Field(default_factory=dict)
    created_by: Optional[str] = None


class OrgRedesignSimulatorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    current_structure: Optional[dict] = None
    proposed_structure: Optional[dict] = None
    impact_analysis: Optional[dict] = None
    status: Optional[str] = None


class OrgRedesignSimulatorResponse(BaseModel):
    id: UUID; tenant_id: str; name: str; description: Optional[str]
    current_structure: dict[Any, Any]
    proposed_structure: dict[Any, Any]
    impact_analysis: dict[Any, Any]; status: str
    created_by: Optional[str]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class StrategicPlanCreate(BaseModel):
    name: str = Field(..., max_length=200)
    period: str = Field(..., max_length=20)
    objectives: list[dict] = Field(default_factory=list)
    kpis: list[dict] = Field(default_factory=list)
    initiatives: list[dict] = Field(default_factory=list)
    created_by: Optional[str] = None


class StrategicPlanUpdate(BaseModel):
    name: Optional[str] = None
    objectives: Optional[list[dict]] = None
    kpis: Optional[list[dict]] = None
    initiatives: Optional[list[dict]] = None
    status: Optional[str] = None
    progress: Optional[float] = None


class StrategicPlanResponse(BaseModel):
    id: UUID; tenant_id: str; name: str; period: str
    objectives: list[Any]; kpis: list[Any]; initiatives: list[Any]
    status: str; progress: float; created_by: Optional[str]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class SimulationRunRequest(BaseModel):
    simulation_type: str = "WORKFORCE"
    parameters: dict = Field(default_factory=dict)


class SimulationRunResponse(BaseModel):
    simulation_id: UUID
    results: dict
    summary: str
