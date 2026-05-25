import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, DateTime, Numeric, ForeignKey, Integer, UniqueConstraint, Index, Date, Boolean
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def utcnow():
    return datetime.now(timezone.utc)


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    department = Column(String(100))
    location = Column(String(200))
    employment_type = Column(String(50))
    description = Column(Text)
    requirements = Column(Text)
    salary_min = Column(Numeric(12, 2))
    salary_max = Column(Numeric(12, 2))
    currency = Column(String(3), default="USD")
    status = Column(String(20), default="DRAFT")
    posted_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50))
    resume_url = Column(Text)
    linkedin_url = Column(String(500))
    portfolio_url = Column(String(500))
    current_company = Column(String(200))
    current_position = Column(String(200))
    location = Column(String(200))
    skills = Column(ARRAY(String))
    experience_years = Column(Numeric(4, 1))
    education_level = Column(String(50))
    source = Column(String(50))
    status = Column(String(30), default="NEW")
    tags = Column(ARRAY(String))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    applications = relationship("Application", back_populates="candidate", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_candidates_tenant_id_email", "tenant_id", "email", unique=True),
        Index("ix_candidates_tenant_id_status", "tenant_id", "status"),
    )


class Application(Base):
    __tablename__ = "applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(30), default="APPLIED")
    application_date = Column(DateTime(timezone=True), default=utcnow)
    cover_letter = Column(Text)
    referral_employee_id = Column(String(100))
    score = Column(Numeric(5, 2))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    job = relationship("Job", back_populates="applications")
    candidate = relationship("Candidate", back_populates="applications")
    interviews = relationship("Interview", back_populates="application", cascade="all, delete-orphan")
    offers = relationship("Offer", back_populates="application", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("job_id", "candidate_id", name="uq_application_job_candidate"),
    )


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    interview_type = Column(String(50))
    interviewer_id = Column(String(100))
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer)
    location = Column(String(300))
    meeting_link = Column(String(500))
    status = Column(String(20), default="SCHEDULED")
    feedback = Column(Text)
    rating = Column(Numeric(2, 1))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    application = relationship("Application", back_populates="interviews")

    __table_args__ = (
        UniqueConstraint("interviewer_id", "scheduled_at", name="uq_interviewer_slot"),
    )


class Offer(Base):
    __tablename__ = "offers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False)
    base_salary = Column(Numeric(12, 2))
    signing_bonus = Column(Numeric(12, 2))
    equity = Column(String(200))
    benefits = Column(Text)
    start_date = Column(Date)
    expiry_date = Column(Date)
    status = Column(String(20), default="DRAFT")
    sent_at = Column(DateTime(timezone=True))
    accepted_at = Column(DateTime(timezone=True))
    declined_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    application = relationship("Application", back_populates="offers")


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=True)
    filename = Column(String(255))
    raw_text = Column(Text)
    parsed_skills = Column(ARRAY(String))
    parsed_experience_years = Column(Numeric(4, 1))
    parsed_education = Column(Text)
    parsed_certifications = Column(ARRAY(String))
    parsed_languages = Column(ARRAY(String))
    parsed_summary = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    candidate = relationship("Candidate")


class ResumeRanking(Base):
    __tablename__ = "resume_rankings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    match_score = Column(Numeric(5, 2))
    skills_match = Column(Numeric(5, 2))
    experience_match = Column(Numeric(5, 2))
    education_match = Column(Numeric(5, 2))
    ai_notes = Column(Text)
    rank = Column(Integer)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    job = relationship("Job")
    candidate = relationship("Candidate")

    __table_args__ = (
        UniqueConstraint("job_id", "candidate_id", name="uq_ranking_job_candidate"),
    )


class OfferTemplate(Base):
    __tablename__ = "offer_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    subject = Column(String(500))
    body_template = Column(Text)
    variables = Column(ARRAY(String))
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class CampusDrive(Base):
    __tablename__ = "campus_drives"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    college_name = Column(String(300), nullable=False)
    college_location = Column(String(200))
    drive_date = Column(Date, nullable=False)
    application_deadline = Column(Date)
    eligible_branches = Column(ARRAY(String))
    eligible_cgpa = Column(Numeric(3, 2))
    max_backlogs = Column(Integer, default=0)
    positions = Column(Integer)
    status = Column(String(20), default="PLANNED")
    coordinator_id = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    registrations = relationship("CampusRegistration", back_populates="drive", cascade="all, delete-orphan")


class CampusRegistration(Base):
    __tablename__ = "campus_registrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    drive_id = Column(UUID(as_uuid=True), ForeignKey("campus_drives.id", ondelete="CASCADE"), nullable=False)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50))
    college_name = Column(String(300))
    branch = Column(String(100))
    graduation_year = Column(Integer)
    cgpa = Column(Numeric(3, 2))
    backlog_count = Column(Integer, default=0)
    resume_url = Column(Text)
    status = Column(String(20), default="REGISTERED")
    test_score = Column(Numeric(5, 2))
    interview_score = Column(Numeric(5, 2))
    created_at = Column(DateTime(timezone=True), default=utcnow)

    drive = relationship("CampusDrive", back_populates="registrations")
    candidate = relationship("Candidate")


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    referrer_employee_id = Column(String(100), nullable=False)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50))
    referral_relationship = Column(String(100))
    notes = Column(Text)
    status = Column(String(20), default="PENDING")
    reward_amount = Column(Numeric(10, 2))
    reward_paid = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    ref_candidate = relationship("Candidate", viewonly=True)


class ChatbotSession(Base):
    __tablename__ = "chatbot_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    visitor_id = Column(String(100))
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), default="ACTIVE")
    context = Column(Text)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    messages = relationship("ChatbotMessage", back_populates="session", cascade="all, delete-orphan")


class ChatbotMessage(Base):
    __tablename__ = "chatbot_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chatbot_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    intent = Column(String(50))
    created_at = Column(DateTime(timezone=True), default=utcnow)

    session = relationship("ChatbotSession", back_populates="messages")
