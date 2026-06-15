from datetime import datetime, date
from decimal import Decimal
from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


# --- Job ---
class JobCreate(BaseModel):
    title: str = Field(..., max_length=200)
    department: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=200)
    employment_type: Optional[str] = Field(None, pattern=r"^(FULL_TIME|PART_TIME|CONTRACT|INTERNSHIP)$")
    description: Optional[str] = None
    requirements: Optional[str] = None
    salary_min: Optional[Decimal] = None
    salary_max: Optional[Decimal] = None
    currency: str = "USD"


class JobUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    department: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=200)
    employment_type: Optional[str] = Field(None, pattern=r"^(FULL_TIME|PART_TIME|CONTRACT|INTERNSHIP)$")
    description: Optional[str] = None
    requirements: Optional[str] = None
    salary_min: Optional[Decimal] = None
    salary_max: Optional[Decimal] = None
    currency: Optional[str] = None


class JobResponse(BaseModel):
    id: str
    tenant_id: str
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    salary_min: Optional[Decimal] = None
    salary_max: Optional[Decimal] = None
    currency: str = "USD"
    status: str = "DRAFT"
    posted_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Candidate ---
class CandidateCreate(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: str = Field(..., max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    resume_url: Optional[str] = None
    linkedin_url: Optional[str] = Field(None, max_length=500)
    portfolio_url: Optional[str] = Field(None, max_length=500)
    current_company: Optional[str] = Field(None, max_length=200)
    current_position: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=200)
    skills: Optional[List[str]] = None
    experience_years: Optional[Decimal] = None
    education_level: Optional[str] = Field(None, max_length=50)
    source: Optional[str] = Field(None, pattern=r"^(LINKEDIN|INDEED|REFERRAL|COMPANY_SITE|RECRUITER|OTHER)$")
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class CandidateUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    resume_url: Optional[str] = None
    linkedin_url: Optional[str] = Field(None, max_length=500)
    portfolio_url: Optional[str] = Field(None, max_length=500)
    current_company: Optional[str] = Field(None, max_length=200)
    current_position: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=200)
    skills: Optional[List[str]] = None
    experience_years: Optional[Decimal] = None
    education_level: Optional[str] = Field(None, max_length=50)
    source: Optional[str] = Field(None, pattern=r"^(LINKEDIN|INDEED|REFERRAL|COMPANY_SITE|RECRUITER|OTHER)$")
    status: Optional[str] = Field(None, pattern=r"^(NEW|SCREENING|INTERVIEWING|OFFER|HIRED|REJECTED|WITHDRAWN)$")
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class CandidateResponse(BaseModel):
    id: str
    tenant_id: str
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    resume_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    current_company: Optional[str] = None
    current_position: Optional[str] = None
    location: Optional[str] = None
    skills: Optional[List[str]] = None
    experience_years: Optional[Decimal] = None
    education_level: Optional[str] = None
    source: Optional[str] = None
    status: str = "NEW"
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ApplicationSummary(BaseModel):
    id: str
    job_id: str
    job_title: Optional[str] = None
    status: str
    application_date: Optional[datetime] = None
    score: Optional[Decimal] = None

    class Config:
        from_attributes = True


class CandidateWithApplications(CandidateResponse):
    applications: List[ApplicationSummary] = []


class AddSkillsRequest(BaseModel):
    skills: List[str] = Field(..., min_length=1)


# --- Interview (defined before ApplicationResponse) ---
class InterviewCreate(BaseModel):
    application_id: str
    interview_type: str = Field(..., pattern=r"^(PHONE|VIDEO|ONSITE|TECHNICAL|HR|FINAL)$")
    interviewer_id: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: Optional[int] = None
    location: Optional[str] = Field(None, max_length=300)
    meeting_link: Optional[str] = Field(None, max_length=500)


class InterviewUpdate(BaseModel):
    interview_type: Optional[str] = Field(None, pattern=r"^(PHONE|VIDEO|ONSITE|TECHNICAL|HR|FINAL)$")
    interviewer_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = Field(None, max_length=300)
    meeting_link: Optional[str] = Field(None, max_length=500)


class InterviewFeedback(BaseModel):
    feedback: Optional[str] = None
    rating: Optional[Decimal] = Field(None, ge=0, le=5)


class InterviewStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(SCHEDULED|COMPLETED|CANCELLED|NO_SHOW)$")


class InterviewResponse(BaseModel):
    id: str
    tenant_id: str
    application_id: str
    interview_type: Optional[str] = None
    interviewer_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    status: str = "SCHEDULED"
    feedback: Optional[str] = None
    rating: Optional[Decimal] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Offer (defined before ApplicationResponse) ---
class OfferCreate(BaseModel):
    application_id: str
    base_salary: Optional[Decimal] = None
    signing_bonus: Optional[Decimal] = None
    equity: Optional[str] = None
    benefits: Optional[str] = None
    start_date: Optional[date] = None
    expiry_date: Optional[date] = None


class OfferUpdate(BaseModel):
    base_salary: Optional[Decimal] = None
    signing_bonus: Optional[Decimal] = None
    equity: Optional[str] = None
    benefits: Optional[str] = None
    start_date: Optional[date] = None
    expiry_date: Optional[date] = None


class OfferResponse(BaseModel):
    id: str
    tenant_id: str
    application_id: str
    base_salary: Optional[Decimal] = None
    signing_bonus: Optional[Decimal] = None
    equity: Optional[str] = None
    benefits: Optional[str] = None
    start_date: Optional[date] = None
    expiry_date: Optional[date] = None
    status: str = "DRAFT"
    sent_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    declined_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Application ---
class ApplicationCreate(BaseModel):
    job_id: str
    candidate_id: str
    cover_letter: Optional[str] = None
    referral_employee_id: Optional[str] = None
    notes: Optional[str] = None


class ApplicationUpdateStatus(BaseModel):
    status: str = Field(..., pattern=r"^(APPLIED|SCREENING|INTERVIEW_STAGE_1|INTERVIEW_STAGE_2|FINAL_INTERVIEW|OFFER_EXTENDED|OFFER_ACCEPTED|HIRED|REJECTED)$")


class ApplicationResponse(BaseModel):
    id: str
    tenant_id: str
    job_id: str
    candidate_id: str
    status: str = "APPLIED"
    application_date: Optional[datetime] = None
    cover_letter: Optional[str] = None
    referral_employee_id: Optional[str] = None
    score: Optional[Decimal] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    job: Optional[JobResponse] = None
    candidate: Optional[CandidateResponse] = None
    interviews: List[InterviewResponse] = []
    offers: List[OfferResponse] = []

    class Config:
        from_attributes = True


class ApplicationListResponse(BaseModel):
    id: str
    tenant_id: str
    job_id: str
    candidate_id: str
    status: str
    application_date: Optional[datetime] = None
    score: Optional[Decimal] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    job_title: Optional[str] = None
    candidate_name: Optional[str] = None

    class Config:
        from_attributes = True


class ApplicationTimelineEvent(BaseModel):
    event: str
    field: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    timestamp: datetime


# --- Analytics ---
class PipelineOverview(BaseModel):
    total_candidates: int
    by_stage: dict
    by_job: List[dict]


class TimeToHire(BaseModel):
    average_days: float
    by_job: List[dict]


class SourceEffectiveness(BaseModel):
    sources: List[dict]


class ConversionFunnel(BaseModel):
    stages: List[dict]


# --- Resume Parser ---
class ResumeUploadResponse(BaseModel):
    id: str
    candidate_id: Optional[str] = None
    filename: Optional[str] = None
    raw_text: Optional[str] = None
    parsed_skills: Optional[List[str]] = None
    parsed_experience_years: Optional[float] = None
    parsed_education: Optional[str] = None
    parsed_certifications: Optional[List[str]] = None
    parsed_languages: Optional[List[str]] = None
    parsed_summary: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ResumeParseResponse(BaseModel):
    skills: List[str]
    experience_years: float
    education: str
    certifications: List[str]
    languages: List[str]
    summary: str


class ResumeCreate(BaseModel):
    candidate_id: Optional[str] = None
    filename: Optional[str] = None
    raw_text: str
    parsed_skills: Optional[List[str]] = None
    parsed_experience_years: Optional[float] = None
    parsed_education: Optional[str] = None
    parsed_certifications: Optional[List[str]] = None
    parsed_languages: Optional[List[str]] = None
    parsed_summary: Optional[str] = None


# --- AI Ranking ---
class RankingResult(BaseModel):
    candidate_id: str
    candidate_name: str
    match_score: float
    skills_match: float
    experience_match: float
    education_match: float
    ai_notes: Optional[str] = None

    class Config:
        from_attributes = True


class RankCandidatesResponse(BaseModel):
    job_id: str
    job_title: Optional[str] = None
    rankings: List[RankingResult]


class CandidateMatchRequest(BaseModel):
    job_id: str
    candidate_ids: List[str] = Field(..., min_length=1)


class CandidateScoreRequest(BaseModel):
    candidate_id: str
    job_id: str


class CandidateScoreResponse(BaseModel):
    candidate_id: str
    job_id: str
    overall_score: float = 0.0
    skill_score: float = 0.0
    experience_score: float = 0.0
    education_score: float = 0.0
    culture_score: float = 0.0
    breakdown: dict = {}


# --- Offer Letter ---
class OfferTemplateCreate(BaseModel):
    name: str = Field(..., max_length=200)
    subject: Optional[str] = Field(None, max_length=500)
    body_template: Optional[str] = None
    variables: Optional[List[str]] = None
    is_default: bool = False


class OfferTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    subject: Optional[str] = Field(None, max_length=500)
    body_template: Optional[str] = None
    variables: Optional[List[str]] = None
    is_default: Optional[bool] = None


class OfferTemplateResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    subject: Optional[str] = None
    body_template: Optional[str] = None
    variables: Optional[List[str]] = None
    is_default: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OfferGenerateRequest(BaseModel):
    offer_id: str
    template_id: str
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    start_date: Optional[str] = None
    salary: Optional[str] = None
    extra_vars: Optional[dict] = None


class OfferGenerateResponse(BaseModel):
    subject: str
    body: str


# --- Campus Recruitment ---
class CampusDriveCreate(BaseModel):
    college_name: str = Field(..., max_length=300)
    college_location: Optional[str] = Field(None, max_length=200)
    drive_date: date
    application_deadline: Optional[date] = None
    eligible_branches: Optional[List[str]] = None
    eligible_cgpa: Optional[float] = Field(None, ge=0, le=10)
    max_backlogs: int = 0
    positions: Optional[int] = None
    coordinator_id: Optional[str] = None
    notes: Optional[str] = None


class CampusDriveUpdate(BaseModel):
    college_name: Optional[str] = Field(None, max_length=300)
    college_location: Optional[str] = Field(None, max_length=200)
    drive_date: Optional[date] = None
    application_deadline: Optional[date] = None
    eligible_branches: Optional[List[str]] = None
    eligible_cgpa: Optional[float] = Field(None, ge=0, le=10)
    max_backlogs: Optional[int] = None
    positions: Optional[int] = None
    coordinator_id: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = Field(None, pattern=r"^(PLANNED|UPCOMING|IN_PROGRESS|COMPLETED|CANCELLED)$")


class CampusDriveResponse(BaseModel):
    id: str
    tenant_id: str
    college_name: str
    college_location: Optional[str] = None
    drive_date: Optional[date] = None
    application_deadline: Optional[date] = None
    eligible_branches: Optional[List[str]] = None
    eligible_cgpa: Optional[float] = None
    max_backlogs: int = 0
    positions: Optional[int] = None
    status: str = "PLANNED"
    coordinator_id: Optional[str] = None
    notes: Optional[str] = None
    registration_count: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CampusRegistrationCreate(BaseModel):
    drive_id: str
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: str = Field(..., max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    college_name: Optional[str] = Field(None, max_length=300)
    branch: Optional[str] = Field(None, max_length=100)
    graduation_year: Optional[int] = None
    cgpa: Optional[float] = Field(None, ge=0, le=10)
    backlog_count: int = 0
    resume_url: Optional[str] = None


class CampusRegistrationUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern=r"^(REGISTERED|SHORTLISTED|TESTED|INTERVIEWED|SELECTED|REJECTED)$")
    test_score: Optional[float] = None
    interview_score: Optional[float] = None


class CampusRegistrationResponse(BaseModel):
    id: str
    tenant_id: str
    drive_id: str
    candidate_id: Optional[str] = None
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    college_name: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[int] = None
    cgpa: Optional[float] = None
    backlog_count: int = 0
    resume_url: Optional[str] = None
    status: str = "REGISTERED"
    test_score: Optional[float] = None
    interview_score: Optional[float] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Referral Management ---
class ReferralCreate(BaseModel):
    referrer_employee_id: str = Field(..., max_length=100)
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: str = Field(..., max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    relationship: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class ReferralUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern=r"^(PENDING|CONTACTED|APPLIED|INTERVIEWING|HIRED|REJECTED)$")
    reward_amount: Optional[float] = None
    reward_paid: Optional[bool] = None
    notes: Optional[str] = None


class ReferralResponse(BaseModel):
    id: str
    tenant_id: str
    referrer_employee_id: str
    candidate_id: Optional[str] = None
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    relationship: Optional[str] = None
    notes: Optional[str] = None
    status: str = "PENDING"
    reward_amount: Optional[float] = None
    reward_paid: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReferralStatsResponse(BaseModel):
    total_referrals: int
    pending: int
    contacted: int
    applied: int
    interviewing: int
    hired: int
    total_reward_amount: float = 0.0
    total_reward_paid: float = 0.0
    top_referrers: List[dict] = []


# --- Recruitment Chatbot ---
class ChatbotSessionCreate(BaseModel):
    visitor_id: Optional[str] = None
    candidate_id: Optional[str] = None


class ChatbotMessageCreate(BaseModel):
    content: str = Field(..., min_length=1)


class ChatbotMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    intent: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChatbotSessionResponse(BaseModel):
    id: str
    tenant_id: str
    visitor_id: Optional[str] = None
    candidate_id: Optional[str] = None
    status: str = "ACTIVE"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    messages: List[ChatbotMessageResponse] = []

    class Config:
        from_attributes = True


class ChatbotIntentResponse(BaseModel):
    intent: str
    confidence: float
    reply: str


# --- Enhanced Analytics ---
class RecruitmentAnalyticsResponse(BaseModel):
    total_jobs: int = 0
    active_jobs: int = 0
    total_candidates: int = 0
    total_applications: int = 0
    total_interviews: int = 0
    total_offers: int = 0
    accepted_offers: int = 0
    offer_acceptance_rate: float = 0.0
    average_time_to_hire_days: float = 0.0
    conversion_funnel: List[dict] = []
    source_breakdown: List[dict] = []
    department_demand: List[dict] = []
    monthly_trend: List[dict] = []


class HiringPipelineResponse(BaseModel):
    active_jobs: int = 0
    total_candidates: int = 0
    active_candidates: int = 0
    interviews_scheduled: int = 0
    offers_extended: int = 0
    offers_accepted: int = 0
    pipeline_stages: List[dict] = []
    upcoming_interviews: List[dict] = []
    recent_activities: List[dict] = []


# Typed paginated response aliases
JobListResponse = PaginatedResponse[JobResponse]
CandidateListResponse = PaginatedResponse[CandidateResponse]
ApplicationListResponse = PaginatedResponse[ApplicationListResponse]
InterviewListResponse = PaginatedResponse[InterviewResponse]
OfferListResponse = PaginatedResponse[OfferResponse]
OfferTemplateListResponse = PaginatedResponse[OfferTemplateResponse]
ResumeListResponse = PaginatedResponse[ResumeUploadResponse]
ReferralListResponse = PaginatedResponse[ReferralResponse]
CampusDriveListResponse = PaginatedResponse[CampusDriveResponse]
CampusRegistrationListResponse = PaginatedResponse[CampusRegistrationResponse]
