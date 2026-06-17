from datetime import date, datetime
from typing import Any, Generic, Optional, TypeVar
from uuid import UUID
from pydantic import BaseModel, Field

T = TypeVar("T")


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


class MessageResponse(BaseModel):
    message: str


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── Onboarding ───────────────────────────────────────────────────────

class OnboardingTemplateCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    department: Optional[str] = None
    default_owner_role: Optional[str] = None
    stages: list[dict] = Field(default_factory=list)
    is_active: bool = True


class OnboardingTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    department: Optional[str] = None
    default_owner_role: Optional[str] = None
    stages: Optional[list[dict]] = None
    is_active: Optional[bool] = None


class OnboardingTemplateResponse(BaseModel):
    id: UUID; tenant_id: str; name: str; description: Optional[str]
    department: Optional[str]; default_owner_role: Optional[str]
    stages: list[Any]; is_active: bool
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class OnboardingAssignmentCreate(BaseModel):
    employee_id: str = Field(..., max_length=100)
    template_id: UUID
    start_date: Optional[date] = None
    expected_completion_date: Optional[date] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class OnboardingAssignmentUpdate(BaseModel):
    status: Optional[str] = None
    current_stage: Optional[str] = None
    stages_completed: Optional[list] = None
    tasks: Optional[list] = None
    expected_completion_date: Optional[date] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class OnboardingAssignmentResponse(BaseModel):
    id: UUID; tenant_id: str; employee_id: str; template_id: Optional[UUID]
    status: str; current_stage: Optional[str]
    stages_completed: list[Any]; tasks: list[Any]
    start_date: Optional[date]; expected_completion_date: Optional[date]
    completed_at: Optional[datetime]; assigned_to: Optional[str]; notes: Optional[str]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


# ── Offboarding ──────────────────────────────────────────────────────

class OffboardingRecordCreate(BaseModel):
    employee_id: str = Field(..., max_length=100)
    resignation_date: Optional[date] = None
    last_working_date: Optional[date] = None
    reason: Optional[str] = None
    reason_details: Optional[str] = None
    notes: Optional[str] = None


class OffboardingRecordUpdate(BaseModel):
    last_working_date: Optional[date] = None
    reason: Optional[str] = None
    reason_details: Optional[str] = None
    status: Optional[str] = None
    clearance_checklist: Optional[list] = None
    asset_return_checklist: Optional[list] = None
    exit_interview_completed: Optional[bool] = None
    final_settlement_amount: Optional[float] = None
    eligible_for_rehire: Optional[bool] = None
    notes: Optional[str] = None


class OffboardingRecordResponse(BaseModel):
    id: UUID; tenant_id: str; employee_id: str
    resignation_date: Optional[date]; last_working_date: Optional[date]
    reason: Optional[str]; reason_details: Optional[str]; status: str
    clearance_checklist: list[Any]; asset_return_checklist: list[Any]
    exit_interview_completed: bool
    final_settlement_amount: Optional[float]; eligible_for_rehire: bool
    notes: Optional[str]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class ExitInterviewCreate(BaseModel):
    offboarding_id: UUID
    employee_id: str = Field(..., max_length=100)
    interviewer_id: Optional[str] = None
    interview_date: Optional[datetime] = None
    feedback: dict = Field(default_factory=dict)
    responses: list = Field(default_factory=list)
    overall_sentiment: Optional[str] = None


class ExitInterviewResponse(BaseModel):
    id: UUID; tenant_id: str; offboarding_id: Optional[UUID]
    employee_id: str; interviewer_id: Optional[str]
    interview_date: Optional[datetime]
    feedback: dict[Any, Any]; responses: list[Any]
    overall_sentiment: Optional[str]
    created_at: datetime
    class Config: from_attributes = True


# ── Probation ────────────────────────────────────────────────────────

class ProbationRecordCreate(BaseModel):
    employee_id: str = Field(..., max_length=100)
    start_date: date
    end_date: date
    probation_length_days: int
    milestones: list[dict] = Field(default_factory=list)
    notes: Optional[str] = None


class ProbationRecordUpdate(BaseModel):
    end_date: Optional[date] = None
    status: Optional[str] = None
    extended: Optional[bool] = None
    extension_days: Optional[int] = None
    extension_reason: Optional[str] = None
    milestones: Optional[list] = None
    overall_rating: Optional[str] = None
    result: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    notes: Optional[str] = None


class ProbationRecordResponse(BaseModel):
    id: UUID; tenant_id: str; employee_id: str
    start_date: date; end_date: date; probation_length_days: int
    status: str; extended: bool; extension_days: Optional[int]
    extension_reason: Optional[str]; milestones: list[Any]
    overall_rating: Optional[str]; result: Optional[str]
    confirmed_at: Optional[datetime]; notes: Optional[str]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class ProbationAssessmentCreate(BaseModel):
    probation_id: UUID
    employee_id: str = Field(..., max_length=100)
    reviewer_id: Optional[str] = None
    assessment_date: Optional[datetime] = None
    period: Optional[str] = None
    ratings: dict = Field(default_factory=dict)
    overall_score: Optional[float] = None
    strengths: Optional[str] = None
    improvements: Optional[str] = None
    recommendation: Optional[str] = None


class ProbationAssessmentUpdate(BaseModel):
    ratings: Optional[dict] = None
    overall_score: Optional[float] = None
    strengths: Optional[str] = None
    improvements: Optional[str] = None
    recommendation: Optional[str] = None
    status: Optional[str] = None


class ProbationAssessmentResponse(BaseModel):
    id: UUID; tenant_id: str; probation_id: Optional[UUID]
    employee_id: str; reviewer_id: Optional[str]
    assessment_date: Optional[datetime]; period: Optional[str]
    ratings: dict[Any, Any]; overall_score: Optional[float]
    strengths: Optional[str]; improvements: Optional[str]
    recommendation: Optional[str]; status: str
    created_at: datetime
    class Config: from_attributes = True


# ── Career ───────────────────────────────────────────────────────────

class CareerFrameworkCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    levels: list[dict] = Field(default_factory=list)


class CareerFrameworkUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    levels: Optional[list[dict]] = None
    is_active: Optional[bool] = None


class CareerFrameworkResponse(BaseModel):
    id: UUID; tenant_id: str; name: str; description: Optional[str]
    levels: list[Any]; is_active: bool
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class JobFamilyCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    framework_id: Optional[UUID] = None
    skills_required: list[str] = Field(default_factory=list)
    career_paths: list[dict] = Field(default_factory=list)


class JobFamilyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    framework_id: Optional[UUID] = None
    skills_required: Optional[list[str]] = None
    career_paths: Optional[list[dict]] = None
    is_active: Optional[bool] = None


class JobFamilyResponse(BaseModel):
    id: UUID; tenant_id: str; name: str; description: Optional[str]
    framework_id: Optional[UUID]; skills_required: list[Any]
    career_paths: list[Any]; is_active: bool
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class CareerPathCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    job_family_id: Optional[UUID] = None
    steps: list[dict] = Field(default_factory=list)
    typical_duration_months: Optional[int] = None


class CareerPathUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    job_family_id: Optional[UUID] = None
    steps: Optional[list[dict]] = None
    typical_duration_months: Optional[int] = None
    is_active: Optional[bool] = None


class CareerPathResponse(BaseModel):
    id: UUID; tenant_id: str; name: str; description: Optional[str]
    job_family_id: Optional[UUID]; steps: list[Any]
    typical_duration_months: Optional[int]; is_active: bool
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


# ── Internal Mobility ────────────────────────────────────────────────

class InternalJobPostingCreate(BaseModel):
    title: str = Field(..., max_length=200)
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    level: Optional[str] = None
    description: Optional[str] = None
    requirements: list[str] = Field(default_factory=list)
    salary_range: dict = Field(default_factory=dict)
    closes_at: Optional[datetime] = None
    hiring_manager: Optional[str] = None


class InternalJobPostingUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    level: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[list[str]] = None
    salary_range: Optional[dict] = None
    status: Optional[str] = None
    closes_at: Optional[datetime] = None
    hiring_manager: Optional[str] = None


class InternalJobPostingResponse(BaseModel):
    id: UUID; tenant_id: str; title: str
    department: Optional[str]; location: Optional[str]
    employment_type: Optional[str]; level: Optional[str]
    description: Optional[str]; requirements: list[Any]
    salary_range: dict[Any, Any]; status: str
    posted_at: Optional[datetime]; closes_at: Optional[datetime]
    hiring_manager: Optional[str]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class InternalApplicationCreate(BaseModel):
    job_id: UUID
    employee_id: str = Field(..., max_length=100)
    current_position: Optional[str] = None
    current_department: Optional[str] = None
    reason: Optional[str] = None
    skills: list[str] = Field(default_factory=list)


class InternalApplicationUpdate(BaseModel):
    status: Optional[str] = None
    reviewer_notes: Optional[str] = None
    reviewed_by: Optional[str] = None


class InternalApplicationResponse(BaseModel):
    id: UUID; tenant_id: str; job_id: Optional[UUID]
    employee_id: str; current_position: Optional[str]
    current_department: Optional[str]; reason: Optional[str]
    skills: list[Any]; status: str
    reviewer_notes: Optional[str]; reviewed_by: Optional[str]
    decided_at: Optional[datetime]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


class TransferRequestCreate(BaseModel):
    employee_id: str = Field(..., max_length=100)
    from_department: Optional[str] = None
    to_department: str = Field(..., max_length=100)
    from_position: Optional[str] = None
    to_position: str = Field(..., max_length=200)
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    reason: Optional[str] = None
    effective_date: Optional[date] = None


class TransferRequestUpdate(BaseModel):
    status: Optional[str] = None
    approved_by: Optional[str] = None
    notes: Optional[str] = None


class TransferRequestResponse(BaseModel):
    id: UUID; tenant_id: str; employee_id: str
    from_department: Optional[str]; to_department: str
    from_position: Optional[str]; to_position: str
    from_location: Optional[str]; to_location: Optional[str]
    reason: Optional[str]; effective_date: Optional[date]
    status: str; approved_by: Optional[str]
    decided_at: Optional[datetime]; notes: Optional[str]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


# ── Promotions ───────────────────────────────────────────────────────

class PromotionRequestCreate(BaseModel):
    employee_id: str = Field(..., max_length=100)
    current_title: Optional[str] = None
    current_level: Optional[str] = None
    proposed_title: str = Field(..., max_length=200)
    proposed_level: Optional[str] = None
    proposed_salary: Optional[float] = None
    reason: Optional[str] = None
    achievements: list[dict] = Field(default_factory=list)


class PromotionRequestUpdate(BaseModel):
    proposed_title: Optional[str] = None
    proposed_level: Optional[str] = None
    proposed_salary: Optional[float] = None
    reason: Optional[str] = None
    achievements: Optional[list[dict]] = None
    recommendations: Optional[list[dict]] = None
    status: Optional[str] = None
    reviewer_id: Optional[str] = None
    reviewer_notes: Optional[str] = None
    approved_by: Optional[str] = None
    effective_date: Optional[date] = None


class PromotionRequestResponse(BaseModel):
    id: UUID; tenant_id: str; employee_id: str
    current_title: Optional[str]; current_level: Optional[str]
    proposed_title: str; proposed_level: Optional[str]
    proposed_salary: Optional[float]; reason: Optional[str]
    achievements: list[Any]; recommendations: list[Any]
    status: str; reviewer_id: Optional[str]; reviewer_notes: Optional[str]
    approved_by: Optional[str]; effective_date: Optional[date]
    decided_at: Optional[datetime]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


# ── Timeline ─────────────────────────────────────────────────────────

class TimelineEventCreate(BaseModel):
    employee_id: str = Field(..., max_length=100)
    event_type: str = Field(..., max_length=50)
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    metadata_json: dict = Field(default_factory=dict, alias="metadata_fields")
    event_date: datetime
    created_by: Optional[str] = None

class TimelineEventResponse(BaseModel):
    id: UUID; tenant_id: str; employee_id: str
    event_type: str; title: str; description: Optional[str]
    metadata_fields: Optional[dict[Any, Any]]
    event_date: datetime; created_by: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True, "populate_by_name": True}


# ── Documents ────────────────────────────────────────────────────────

class EmployeeDocumentCreate(BaseModel):
    employee_id: str = Field(..., max_length=100)
    name: str = Field(..., max_length=200)
    category: str = Field(..., max_length=50)
    document_type: Optional[str] = None
    file_url: Optional[str] = None
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    is_confidential: bool = False
    expiry_date: Optional[date] = None
    uploaded_by: Optional[str] = None
    notes: Optional[str] = None


class EmployeeDocumentUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    file_url: Optional[str] = None
    tags: Optional[list[str]] = None
    is_confidential: Optional[bool] = None
    expiry_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class EmployeeDocumentResponse(BaseModel):
    id: UUID; tenant_id: str; employee_id: str
    name: str; category: str; document_type: Optional[str]
    file_url: Optional[str]; file_size_bytes: Optional[int]
    mime_type: Optional[str]; version: int
    tags: list[Any]; is_confidential: bool
    expiry_date: Optional[date]; status: str
    uploaded_by: Optional[str]; notes: Optional[str]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


# ── Profile ──────────────────────────────────────────────────────────

class EmployeeProfileUpdate(BaseModel):
    personal_info: Optional[dict] = None
    contact_info: Optional[dict] = None
    employment_info: Optional[dict] = None
    education: Optional[list] = None
    certifications: Optional[list] = None
    work_history: Optional[list] = None
    emergency_contacts: Optional[list] = None
    skills_summary: Optional[dict] = None
    documents_summary: Optional[dict] = None
    preferences: Optional[dict] = None
    custom_fields: Optional[dict] = None


class EmployeeProfileResponse(BaseModel):
    id: UUID; tenant_id: str; employee_id: str
    personal_info: dict[Any, Any]; contact_info: dict[Any, Any]
    employment_info: dict[Any, Any]
    education: list[Any]; certifications: list[Any]
    work_history: list[Any]; emergency_contacts: list[Any]
    skills_summary: dict[Any, Any]; documents_summary: dict[Any, Any]
    preferences: dict[Any, Any]; custom_fields: dict[Any, Any]
    profile_completeness: int
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True


# ── Achievements ─────────────────────────────────────────────────────

class EmployeeAchievementCreate(BaseModel):
    employee_id: str = Field(..., max_length=100)
    title: str = Field(..., max_length=200)
    category: str = Field(..., max_length=50)
    description: Optional[str] = None
    date_awarded: Optional[date] = None
    issuer: Optional[str] = None
    recognition_type: Optional[str] = None
    badge_url: Optional[str] = None
    certificate_url: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    is_public: bool = True
    created_by: Optional[str] = None


class EmployeeAchievementUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    issuer: Optional[str] = None
    badge_url: Optional[str] = None
    certificate_url: Optional[str] = None
    tags: Optional[list[str]] = None
    is_public: Optional[bool] = None


class EmployeeAchievementResponse(BaseModel):
    id: UUID; tenant_id: str; employee_id: str
    title: str; category: str; description: Optional[str]
    date_awarded: Optional[date]; issuer: Optional[str]
    recognition_type: Optional[str]
    badge_url: Optional[str]; certificate_url: Optional[str]
    tags: list[Any]; is_public: bool; created_by: Optional[str]
    created_at: datetime
    class Config: from_attributes = True


# ── Career Roadmap ───────────────────────────────────────────────────

class CareerRoadmapCreate(BaseModel):
    employee_id: str = Field(..., max_length=100)
    career_path_id: Optional[UUID] = None
    milestones: list[dict] = Field(default_factory=list)
    current_step: int = 0
    target_role: Optional[str] = None
    target_level: Optional[str] = None
    estimated_time_months: Optional[int] = None
    notes: Optional[str] = None


class CareerRoadmapUpdate(BaseModel):
    milestones: Optional[list[dict]] = None
    current_step: Optional[int] = None
    target_role: Optional[str] = None
    target_level: Optional[str] = None
    estimated_time_months: Optional[int] = None
    progress_percentage: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class CareerRoadmapResponse(BaseModel):
    id: UUID; tenant_id: str; employee_id: str
    career_path_id: Optional[UUID]; milestones: list[Any]
    current_step: int; target_role: Optional[str]
    target_level: Optional[str]; estimated_time_months: Optional[int]
    progress_percentage: float; is_active: bool; notes: Optional[str]
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True
