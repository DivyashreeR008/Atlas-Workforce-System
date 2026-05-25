from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field


class PaginatedResponse(BaseModel):
    items: List
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
