import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def utcnow():
    return datetime.now(timezone.utc)


# ── Onboarding ───────────────────────────────────────────────────────

class OnboardingTemplate(Base):
    __tablename__ = "lifecycle_onboarding_templates"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    department = Column(String(100))
    default_owner_role = Column(String(50))
    stages = Column(JSONB, nullable=False, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_onboard_tmpl_tenant", "tenant_id"),)


class OnboardingAssignment(Base):
    __tablename__ = "lifecycle_onboarding_assignments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    employee_id = Column(String(100), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("lifecycle_onboarding_templates.id"))
    status = Column(String(20), nullable=False, default="PENDING")
    current_stage = Column(String(100))
    stages_completed = Column(JSONB, default=list)
    tasks = Column(JSONB, default=list)
    start_date = Column(Date)
    expected_completion_date = Column(Date)
    completed_at = Column(DateTime(timezone=True))
    assigned_to = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    template = relationship("OnboardingTemplate")
    __table_args__ = (Index("idx_onboard_assign_employee", "employee_id"), Index("idx_onboard_assign_tenant", "tenant_id"))


# ── Offboarding ──────────────────────────────────────────────────────

class OffboardingRecord(Base):
    __tablename__ = "lifecycle_offboarding_records"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    employee_id = Column(String(100), nullable=False)
    resignation_date = Column(Date)
    last_working_date = Column(Date)
    reason = Column(String(50))
    reason_details = Column(Text)
    status = Column(String(20), nullable=False, default="PENDING")
    clearance_checklist = Column(JSONB, default=list)
    asset_return_checklist = Column(JSONB, default=list)
    exit_interview_completed = Column(Boolean, default=False)
    final_settlement_amount = Column(Float)
    eligible_for_rehire = Column(Boolean, default=True)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_offboard_employee", "employee_id"), Index("idx_offboard_tenant", "tenant_id"))


class ExitInterview(Base):
    __tablename__ = "lifecycle_exit_interviews"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    offboarding_id = Column(UUID(as_uuid=True), ForeignKey("lifecycle_offboarding_records.id"))
    employee_id = Column(String(100), nullable=False)
    interviewer_id = Column(String(100))
    interview_date = Column(DateTime(timezone=True))
    feedback = Column(JSONB, default=dict)
    responses = Column(JSONB, default=list)
    overall_sentiment = Column(String(20))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    offboarding = relationship("OffboardingRecord")
    __table_args__ = (Index("idx_exit_offboard", "offboarding_id"),)


# ── Probation ────────────────────────────────────────────────────────

class ProbationRecord(Base):
    __tablename__ = "lifecycle_probation_records"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    employee_id = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    probation_length_days = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="ACTIVE")
    extended = Column(Boolean, default=False)
    extension_days = Column(Integer)
    extension_reason = Column(Text)
    milestones = Column(JSONB, default=list)
    overall_rating = Column(String(20))
    result = Column(String(20))
    confirmed_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_probation_employee", "employee_id"), Index("idx_probation_tenant", "tenant_id"))


class ProbationAssessment(Base):
    __tablename__ = "lifecycle_probation_assessments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    probation_id = Column(UUID(as_uuid=True), ForeignKey("lifecycle_probation_records.id"))
    employee_id = Column(String(100), nullable=False)
    reviewer_id = Column(String(100))
    assessment_date = Column(DateTime(timezone=True))
    period = Column(String(50))
    ratings = Column(JSONB, default=dict)
    overall_score = Column(Float)
    strengths = Column(Text)
    improvements = Column(Text)
    recommendation = Column(String(50))
    status = Column(String(20), default="DRAFT")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    probation = relationship("ProbationRecord")
    __table_args__ = (Index("idx_probation_assess", "probation_id"),)


# ── Career ───────────────────────────────────────────────────────────

class CareerFramework(Base):
    __tablename__ = "lifecycle_career_frameworks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    levels = Column(JSONB, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_career_fw_tenant", "tenant_id"),)


class JobFamily(Base):
    __tablename__ = "lifecycle_job_families"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    framework_id = Column(UUID(as_uuid=True), ForeignKey("lifecycle_career_frameworks.id"))
    skills_required = Column(JSONB, default=list)
    career_paths = Column(JSONB, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    framework = relationship("CareerFramework")
    __table_args__ = (Index("idx_job_family_tenant", "tenant_id"),)


class CareerPath(Base):
    __tablename__ = "lifecycle_career_paths"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    job_family_id = Column(UUID(as_uuid=True), ForeignKey("lifecycle_job_families.id"))
    steps = Column(JSONB, default=list)
    typical_duration_months = Column(Integer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    job_family = relationship("JobFamily")
    __table_args__ = (Index("idx_career_path_tenant", "tenant_id"),)


# ── Internal Mobility ────────────────────────────────────────────────

class InternalJobPosting(Base):
    __tablename__ = "lifecycle_internal_jobs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    department = Column(String(100))
    location = Column(String(200))
    employment_type = Column(String(50))
    level = Column(String(100))
    description = Column(Text)
    requirements = Column(JSONB, default=list)
    salary_range = Column(JSONB, default=dict)
    status = Column(String(20), nullable=False, default="DRAFT")
    posted_at = Column(DateTime(timezone=True))
    closes_at = Column(DateTime(timezone=True))
    hiring_manager = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    applications = relationship("InternalApplication", back_populates="job")
    __table_args__ = (Index("idx_int_job_tenant", "tenant_id"),)


class InternalApplication(Base):
    __tablename__ = "lifecycle_internal_applications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey("lifecycle_internal_jobs.id"))
    employee_id = Column(String(100), nullable=False)
    current_position = Column(String(200))
    current_department = Column(String(100))
    reason = Column(Text)
    skills = Column(JSONB, default=list)
    status = Column(String(20), nullable=False, default="SUBMITTED")
    reviewer_notes = Column(Text)
    reviewed_by = Column(String(100))
    decided_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    job = relationship("InternalJobPosting", back_populates="applications")
    __table_args__ = (Index("idx_int_app_employee", "employee_id"), Index("idx_int_app_job", "job_id"))


class TransferRequest(Base):
    __tablename__ = "lifecycle_transfer_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    employee_id = Column(String(100), nullable=False)
    from_department = Column(String(100))
    to_department = Column(String(100), nullable=False)
    from_position = Column(String(200))
    to_position = Column(String(200), nullable=False)
    from_location = Column(String(200))
    to_location = Column(String(200))
    reason = Column(Text)
    effective_date = Column(Date)
    status = Column(String(20), nullable=False, default="PENDING")
    approved_by = Column(String(100))
    decided_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_transfer_employee", "employee_id"), Index("idx_transfer_tenant", "tenant_id"))


# ── Promotions ───────────────────────────────────────────────────────

class PromotionRequest(Base):
    __tablename__ = "lifecycle_promotion_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    employee_id = Column(String(100), nullable=False)
    current_title = Column(String(200))
    current_level = Column(String(100))
    proposed_title = Column(String(200), nullable=False)
    proposed_level = Column(String(100))
    proposed_salary = Column(Float)
    reason = Column(Text)
    achievements = Column(JSONB, default=list)
    recommendations = Column(JSONB, default=list)
    status = Column(String(20), nullable=False, default="DRAFT")
    reviewer_id = Column(String(100))
    reviewer_notes = Column(Text)
    approved_by = Column(String(100))
    effective_date = Column(Date)
    decided_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_promo_employee", "employee_id"), Index("idx_promo_tenant", "tenant_id"))


# ── Employee Timeline ────────────────────────────────────────────────

class EmployeeTimelineEvent(Base):
    __tablename__ = "lifecycle_employee_timeline"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    employee_id = Column(String(100), nullable=False)
    event_type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    metadata_json = Column("metadata_fields", JSONB, default=dict)
    event_date = Column(DateTime(timezone=True), nullable=False)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (Index("idx_timeline_employee", "employee_id", "event_date"), Index("idx_timeline_tenant", "tenant_id"))


# ── Employee Documents ───────────────────────────────────────────────

class EmployeeDocument(Base):
    __tablename__ = "lifecycle_employee_documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    employee_id = Column(String(100), nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)
    document_type = Column(String(100))
    file_url = Column(String(500))
    file_size_bytes = Column(Integer)
    mime_type = Column(String(100))
    version = Column(Integer, nullable=False, default=1)
    tags = Column(JSONB, default=list)
    is_confidential = Column(Boolean, default=False)
    expiry_date = Column(Date)
    status = Column(String(20), default="ACTIVE")
    uploaded_by = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_doc_employee", "employee_id", "category"), Index("idx_doc_tenant", "tenant_id"))


# ── Employee Profile ─────────────────────────────────────────────────

class EmployeeProfile(Base):
    __tablename__ = "lifecycle_employee_profiles"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    employee_id = Column(String(100), nullable=False, unique=True)
    personal_info = Column(JSONB, default=dict)
    contact_info = Column(JSONB, default=dict)
    employment_info = Column(JSONB, default=dict)
    education = Column(JSONB, default=list)
    certifications = Column(JSONB, default=list)
    work_history = Column(JSONB, default=list)
    emergency_contacts = Column(JSONB, default=list)
    skills_summary = Column(JSONB, default=dict)
    documents_summary = Column(JSONB, default=dict)
    preferences = Column(JSONB, default=dict)
    custom_fields = Column(JSONB, default=dict)
    profile_completeness = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_profile_tenant", "tenant_id"),)


# ── Achievements ─────────────────────────────────────────────────────

class EmployeeAchievement(Base):
    __tablename__ = "lifecycle_employee_achievements"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    employee_id = Column(String(100), nullable=False)
    title = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)
    description = Column(Text)
    date_awarded = Column(Date)
    issuer = Column(String(200))
    recognition_type = Column(String(50))
    badge_url = Column(String(500))
    certificate_url = Column(String(500))
    tags = Column(JSONB, default=list)
    is_public = Column(Boolean, default=True)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (Index("idx_achievement_employee", "employee_id"), Index("idx_achievement_tenant", "tenant_id"))


# ── Career Roadmap ───────────────────────────────────────────────────

class CareerRoadmap(Base):
    __tablename__ = "lifecycle_career_roadmaps"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    employee_id = Column(String(100), nullable=False)
    career_path_id = Column(UUID(as_uuid=True), ForeignKey("lifecycle_career_paths.id"))
    milestones = Column(JSONB, default=list)
    current_step = Column(Integer, default=0)
    target_role = Column(String(200))
    target_level = Column(String(100))
    estimated_time_months = Column(Integer)
    progress_percentage = Column(Float, default=0)
    is_active = Column(Boolean, default=True)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    career_path = relationship("CareerPath")
    __table_args__ = (Index("idx_roadmap_employee", "employee_id"), Index("idx_roadmap_tenant", "tenant_id"))
