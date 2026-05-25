import uuid
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from models import (
    Job, Candidate, Application, Interview, Offer,
    Resume, ResumeRanking, OfferTemplate,
    CampusDrive, CampusRegistration, Referral,
    ChatbotSession, ChatbotMessage,
)
import schemas


# --- Helper ---
def apply_pagination(query, page: int, page_size: int):
    return query.offset((page - 1) * page_size).limit(page_size)


def paginated_response(items, total: int, page: int, page_size: int):
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def serialize_uuid(obj):
    d = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, uuid.UUID):
            val = str(val)
        elif isinstance(val, Decimal):
            val = float(val)
        elif isinstance(val, datetime):
            val = val.isoformat()
        d[col.name] = val
    return d


# --- Job ---
def list_jobs(
    db: Session,
    tenant_id: str,
    page: int,
    page_size: int,
    status: Optional[str] = None,
    department: Optional[str] = None,
    employment_type: Optional[str] = None,
) -> dict:
    q = db.query(Job).filter(Job.tenant_id == tenant_id)
    if status:
        q = q.filter(Job.status == status)
    if department:
        q = q.filter(Job.department == department)
    if employment_type:
        q = q.filter(Job.employment_type == employment_type)
    q = q.order_by(Job.created_at.desc())
    total = q.count()
    items = apply_pagination(q, page, page_size).all()
    return paginated_response([serialize_uuid(j) for j in items], total, page, page_size)


def create_job(db: Session, tenant_id: str, data: schemas.JobCreate) -> Job:
    job = Job(tenant_id=tenant_id, **data.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return serialize_uuid(job)


def get_job(db: Session, job_id: str, tenant_id: str) -> Optional[dict]:
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tenant_id).first()
    if not job:
        return None
    return serialize_uuid(job)


def update_job(db: Session, job_id: str, tenant_id: str, data: schemas.JobUpdate) -> Optional[dict]:
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tenant_id).first()
    if not job:
        return None
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        return serialize_uuid(job)
    for key, value in update_data.items():
        setattr(job, key, value)
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return serialize_uuid(job)


def delete_job(db: Session, job_id: str, tenant_id: str) -> bool:
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tenant_id).first()
    if not job:
        return False
    db.delete(job)
    db.commit()
    return True


def publish_job(db: Session, job_id: str, tenant_id: str) -> Optional[dict]:
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tenant_id).first()
    if not job:
        return None
    job.status = "PUBLISHED"
    job.posted_at = datetime.now(timezone.utc)
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return serialize_uuid(job)


def close_job(db: Session, job_id: str, tenant_id: str) -> Optional[dict]:
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tenant_id).first()
    if not job:
        return None
    job.status = "CLOSED"
    job.closed_at = datetime.now(timezone.utc)
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return serialize_uuid(job)


def get_job_applications(db: Session, job_id: str, tenant_id: str, page: int, page_size: int) -> dict:
    q = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Application.job_id == job_id, Job.tenant_id == tenant_id)
        .order_by(Application.application_date.desc())
    )
    total = q.count()
    items = apply_pagination(q, page, page_size).all()
    result = []
    for app in items:
        d = serialize_uuid(app)
        d["job_title"] = app.job.title if app.job else None
        d["candidate_name"] = f"{app.candidate.first_name} {app.candidate.last_name}" if app.candidate else None
        result.append(d)
    return paginated_response(result, total, page, page_size)


# --- Candidate ---
def list_candidates(
    db: Session,
    tenant_id: str,
    page: int,
    page_size: int,
    status: Optional[str] = None,
    skills: Optional[List[str]] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
) -> dict:
    q = db.query(Candidate).filter(Candidate.tenant_id == tenant_id)
    if status:
        q = q.filter(Candidate.status == status)
    if source:
        q = q.filter(Candidate.source == source)
    if skills:
        q = q.filter(Candidate.skills.overlap(skills))
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            or_(
                Candidate.first_name.ilike(pattern),
                Candidate.last_name.ilike(pattern),
                Candidate.email.ilike(pattern),
                Candidate.current_company.ilike(pattern),
                Candidate.current_position.ilike(pattern),
            )
        )
    q = q.order_by(Candidate.created_at.desc())
    total = q.count()
    items = apply_pagination(q, page, page_size).all()
    return paginated_response([serialize_uuid(c) for c in items], total, page, page_size)


def create_candidate(db: Session, tenant_id: str, data: schemas.CandidateCreate) -> Candidate:
    candidate = Candidate(tenant_id=tenant_id, **data.model_dump())
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return serialize_uuid(candidate)


def get_candidate(db: Session, candidate_id: str, tenant_id: str) -> Optional[dict]:
    candidate = (
        db.query(Candidate)
        .filter(Candidate.id == candidate_id, Candidate.tenant_id == tenant_id)
        .first()
    )
    if not candidate:
        return None
    result = serialize_uuid(candidate)
    apps = (
        db.query(Application)
        .filter(Application.candidate_id == candidate_id)
        .order_by(Application.application_date.desc())
        .all()
    )
    result["applications"] = []
    for app in apps:
        app_data = {
            "id": str(app.id),
            "job_id": str(app.job_id),
            "job_title": app.job.title if app.job else None,
            "status": app.status,
            "application_date": app.application_date.isoformat() if app.application_date else None,
            "score": float(app.score) if app.score else None,
        }
        result["applications"].append(app_data)
    return result


def update_candidate(db: Session, candidate_id: str, tenant_id: str, data: schemas.CandidateUpdate) -> Optional[dict]:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == tenant_id).first()
    if not candidate:
        return None
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        return serialize_uuid(candidate)
    for key, value in update_data.items():
        setattr(candidate, key, value)
    candidate.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(candidate)
    return serialize_uuid(candidate)


def delete_candidate(db: Session, candidate_id: str, tenant_id: str) -> bool:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == tenant_id).first()
    if not candidate:
        return False
    candidate.status = "WITHDRAWN"
    candidate.updated_at = datetime.now(timezone.utc)
    db.commit()
    return True


def get_candidate_applications(db: Session, candidate_id: str, tenant_id: str, page: int, page_size: int) -> dict:
    q = (
        db.query(Application)
        .join(Candidate, Application.candidate_id == Candidate.id)
        .filter(Application.candidate_id == candidate_id, Candidate.tenant_id == tenant_id)
        .order_by(Application.application_date.desc())
    )
    total = q.count()
    items = apply_pagination(q, page, page_size).all()
    result = []
    for app in items:
        d = serialize_uuid(app)
        d["job_title"] = app.job.title if app.job else None
        d["candidate_name"] = f"{app.candidate.first_name} {app.candidate.last_name}" if app.candidate else None
        result.append(d)
    return paginated_response(result, total, page, page_size)


def add_candidate_skills(db: Session, candidate_id: str, tenant_id: str, skills: List[str]) -> Optional[dict]:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == tenant_id).first()
    if not candidate:
        return None
    existing = set(candidate.skills or [])
    new_skills = [s for s in skills if s not in existing]
    if new_skills:
        candidate.skills = (candidate.skills or []) + new_skills
        candidate.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(candidate)
    return serialize_uuid(candidate)


# --- Application ---
def list_applications(
    db: Session,
    tenant_id: str,
    page: int,
    page_size: int,
    job_id: Optional[str] = None,
    candidate_id: Optional[str] = None,
    status: Optional[str] = None,
) -> dict:
    q = db.query(Application).filter(Application.tenant_id == tenant_id)
    if job_id:
        q = q.filter(Application.job_id == job_id)
    if candidate_id:
        q = q.filter(Application.candidate_id == candidate_id)
    if status:
        q = q.filter(Application.status == status)
    q = q.order_by(Application.application_date.desc())
    total = q.count()
    items = apply_pagination(q, page, page_size).all()
    result = []
    for app in items:
        d = serialize_uuid(app)
        d["job_title"] = app.job.title if app.job else None
        d["candidate_name"] = f"{app.candidate.first_name} {app.candidate.last_name}" if app.candidate else None
        result.append(d)
    return paginated_response(result, total, page, page_size)


def create_application(db: Session, tenant_id: str, data: schemas.ApplicationCreate) -> Optional[dict]:
    job = db.query(Job).filter(Job.id == data.job_id).first()
    if not job:
        return None
    candidate = db.query(Candidate).filter(Candidate.id == data.candidate_id).first()
    if not candidate:
        return None
    existing = (
        db.query(Application)
        .filter(Application.job_id == data.job_id, Application.candidate_id == data.candidate_id)
        .first()
    )
    if existing:
        return None
    application = Application(tenant_id=tenant_id, **data.model_dump())
    db.add(application)
    db.commit()
    db.refresh(application)
    return serialize_uuid(application)


def get_application(db: Session, application_id: str, tenant_id: str) -> Optional[dict]:
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.tenant_id == tenant_id)
        .first()
    )
    if not app:
        return None
    d = serialize_uuid(app)
    if app.job:
        d["job"] = serialize_uuid(app.job)
    if app.candidate:
        d["candidate"] = serialize_uuid(app.candidate)
    d["interviews"] = [serialize_uuid(iv) for iv in (app.interviews or [])]
    d["offers"] = [serialize_uuid(of) for of in (app.offers or [])]
    return d


APPLICATION_TRANSITIONS = {
    "APPLIED": ["SCREENING", "REJECTED"],
    "SCREENING": ["INTERVIEW_STAGE_1", "REJECTED"],
    "INTERVIEW_STAGE_1": ["INTERVIEW_STAGE_2", "FINAL_INTERVIEW", "REJECTED"],
    "INTERVIEW_STAGE_2": ["FINAL_INTERVIEW", "REJECTED"],
    "FINAL_INTERVIEW": ["OFFER_EXTENDED", "REJECTED"],
    "OFFER_EXTENDED": ["OFFER_ACCEPTED", "HIRED", "REJECTED"],
    "OFFER_ACCEPTED": ["HIRED"],
    "HIRED": [],
    "REJECTED": [],
}


def update_application_status(db: Session, application_id: str, tenant_id: str, new_status: str) -> Optional[dict]:
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.tenant_id == tenant_id)
        .with_for_update()
        .first()
    )
    if not app:
        return None
    allowed = APPLICATION_TRANSITIONS.get(app.status, [])
    if new_status not in allowed:
        return None
    app.status = new_status
    app.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(app)
    return serialize_uuid(app)


def get_application_timeline(db: Session, application_id: str, tenant_id: str) -> Optional[List[dict]]:
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.tenant_id == tenant_id)
        .first()
    )
    if not app:
        return None
    events = [
        {"event": "Application submitted", "field": None, "old_value": None, "new_value": None,
            "timestamp": app.created_at.isoformat() if app.created_at else None},
        {"event": f"Status changed to {app.status}", "field": "status", "old_value": None,
            "new_value": app.status, "timestamp": app.updated_at.isoformat() if app.updated_at else None},
    ]
    if app.interviews:
        for iv in app.interviews:
            events.append({
                "event": f"Interview scheduled: {iv.interview_type}",
                "field": "interview",
                "old_value": None,
                "new_value": iv.interview_type,
                "timestamp": iv.scheduled_at.isoformat() if iv.scheduled_at else None,
            })
    if app.offers:
        for of in app.offers:
            events.append({
                "event": f"Offer {of.status}",
                "field": "offer",
                "old_value": None,
                "new_value": of.status,
                "timestamp": (of.sent_at or of.created_at).isoformat() if (of.sent_at or of.created_at) else None,
            })
    return sorted(events, key=lambda e: e["timestamp"] or "")


# --- Interview ---
def check_interview_overlap(db: Session, interviewer_id: str, scheduled_at: datetime, duration_minutes: Optional[int] = None, exclude_id: Optional[str] = None) -> bool:
    if not interviewer_id:
        return False
    query = db.query(Interview).filter(
        Interview.interviewer_id == interviewer_id,
        Interview.scheduled_at == scheduled_at,
        Interview.status.in_(["SCHEDULED", "COMPLETED"]),
    )
    if exclude_id:
        query = query.filter(Interview.id != exclude_id)
    return query.first() is not None


def list_interviews(
    db: Session,
    tenant_id: str,
    page: int,
    page_size: int,
    interviewer_id: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    q = db.query(Interview).filter(Interview.tenant_id == tenant_id)
    if interviewer_id:
        q = q.filter(Interview.interviewer_id == interviewer_id)
    if date_from:
        q = q.filter(Interview.scheduled_at >= date_from)
    if date_to:
        q = q.filter(Interview.scheduled_at <= date_to)
    q = q.order_by(Interview.scheduled_at.desc())
    total = q.count()
    items = apply_pagination(q, page, page_size).all()
    return paginated_response([serialize_uuid(iv) for iv in items], total, page, page_size)


def create_interview(db: Session, tenant_id: str, data: schemas.InterviewCreate) -> Optional[dict]:
    app = db.query(Application).filter(Application.id == data.application_id).first()
    if not app:
        return None
    interview = Interview(tenant_id=tenant_id, **data.model_dump())
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return serialize_uuid(interview)


def update_interview(db: Session, interview_id: str, tenant_id: str, data: schemas.InterviewUpdate) -> Optional[dict]:
    interview = db.query(Interview).filter(Interview.id == interview_id, Interview.tenant_id == tenant_id).first()
    if not interview:
        return None
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        return serialize_uuid(interview)
    new_interviewer = update_data.get("interviewer_id", interview.interviewer_id)
    new_scheduled_at = update_data.get("scheduled_at", interview.scheduled_at)
    new_duration = update_data.get("duration_minutes", interview.duration_minutes)
    if new_interviewer and check_interview_overlap(db, new_interviewer, new_scheduled_at, new_duration, exclude_id=interview_id):
        return None
    for key, value in update_data.items():
        setattr(interview, key, value)
    interview.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(interview)
    return serialize_uuid(interview)


def submit_interview_feedback(db: Session, interview_id: str, tenant_id: str,
                              data: schemas.InterviewFeedback) -> Optional[dict]:
    interview = db.query(Interview).filter(Interview.id == interview_id, Interview.tenant_id == tenant_id).first()
    if not interview:
        return None
    update_data = data.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(interview, key, value)
    interview.status = "COMPLETED"
    interview.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(interview)
    return serialize_uuid(interview)


def update_interview_status(db: Session, interview_id: str, tenant_id: str, status: str) -> Optional[dict]:
    interview = db.query(Interview).filter(Interview.id == interview_id, Interview.tenant_id == tenant_id).first()
    if not interview:
        return None
    interview.status = status
    interview.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(interview)
    return serialize_uuid(interview)


# --- Offer ---
def list_offers(
    db: Session,
    tenant_id: str,
    page: int,
    page_size: int,
    status: Optional[str] = None,
) -> dict:
    q = db.query(Offer).filter(Offer.tenant_id == tenant_id)
    if status:
        q = q.filter(Offer.status == status)
    q = q.order_by(Offer.created_at.desc())
    total = q.count()
    items = apply_pagination(q, page, page_size).all()
    return paginated_response([serialize_uuid(of) for of in items], total, page, page_size)


def create_offer(db: Session, tenant_id: str, data: schemas.OfferCreate) -> Optional[dict]:
    app = db.query(Application).filter(Application.id == data.application_id).first()
    if not app:
        return None
    offer = Offer(tenant_id=tenant_id, **data.model_dump())
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return serialize_uuid(offer)


def update_offer(db: Session, offer_id: str, tenant_id: str, data: schemas.OfferUpdate) -> Optional[dict]:
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == tenant_id).first()
    if not offer:
        return None
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        return serialize_uuid(offer)
    for key, value in update_data.items():
        setattr(offer, key, value)
    offer.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(offer)
    return serialize_uuid(offer)


def send_offer(db: Session, offer_id: str, tenant_id: str) -> Optional[dict]:
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == tenant_id).first()
    if not offer:
        return None
    offer.status = "SENT"
    offer.sent_at = datetime.now(timezone.utc)
    offer.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(offer)
    return serialize_uuid(offer)


def accept_offer(db: Session, offer_id: str, tenant_id: str) -> Optional[dict]:
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == tenant_id).first()
    if not offer:
        return None
    offer.status = "ACCEPTED"
    offer.accepted_at = datetime.now(timezone.utc)
    offer.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(offer)
    return serialize_uuid(offer)


def decline_offer(db: Session, offer_id: str, tenant_id: str) -> Optional[dict]:
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == tenant_id).first()
    if not offer:
        return None
    offer.status = "DECLINED"
    offer.declined_at = datetime.now(timezone.utc)
    offer.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(offer)
    return serialize_uuid(offer)


# --- Analytics ---
def get_pipeline_overview(db: Session, tenant_id: str) -> dict:
    total = db.query(func.count(Candidate.id)).filter(Candidate.tenant_id == tenant_id).scalar() or 0
    stages = (
        db.query(Candidate.status, func.count(Candidate.id))
        .filter(Candidate.tenant_id == tenant_id)
        .group_by(Candidate.status)
        .all()
    )
    by_stage = {s: c for s, c in stages}
    jobs_stats = (
        db.query(Job.id, Job.title, func.count(Application.id))
        .outerjoin(Application, Application.job_id == Job.id)
        .filter(Job.tenant_id == tenant_id)
        .group_by(Job.id, Job.title)
        .all()
    )
    by_job = [{"job_id": str(jid), "title": title, "applications": count} for jid, title, count in jobs_stats]
    return {"total_candidates": total, "by_stage": by_stage, "by_job": by_job}


def get_time_to_hire(db: Session, tenant_id: str) -> dict:
    apps = (
        db.query(
            Job.id,
            Job.title,
            func.avg(
                func.extract("epoch", Application.updated_at - Application.application_date) / 86400.0
            ).label("avg_days"),
        )
        .join(Application, Application.job_id == Job.id)
        .filter(
            Job.tenant_id == tenant_id,
            Application.status.in_(["HIRED", "OFFER_ACCEPTED"]),
        )
        .group_by(Job.id, Job.title)
        .all()
    )
    by_job = [
        {"job_id": str(jid), "title": title, "avg_days": round(float(avg), 1) if avg else 0.0}
        for jid, title, avg in apps
    ]
    avg_all = sum(j["avg_days"] for j in by_job) / len(by_job) if by_job else 0.0
    return {"average_days": round(avg_all, 1), "by_job": by_job}


def get_source_effectiveness(db: Session, tenant_id: str) -> dict:
    sources = (
        db.query(Candidate.source, func.count(Candidate.id))
        .filter(Candidate.tenant_id == tenant_id)
        .group_by(Candidate.source)
        .all()
    )
    return {"sources": [{"source": s, "count": c} for s, c in sources if s]}


def get_conversion_funnel(db: Session, tenant_id: str) -> dict:
    stages_order = [
        "APPLIED",
        "SCREENING",
        "INTERVIEW_STAGE_1",
        "INTERVIEW_STAGE_2",
        "FINAL_INTERVIEW",
        "OFFER_EXTENDED",
        "OFFER_ACCEPTED",
        "HIRED"]
    stages = []
    total_apps = (
        db.query(func.count(Application.id))
        .filter(Application.tenant_id == tenant_id)
        .scalar() or 1
    )
    for i, stage in enumerate(stages_order):
        count = (
            db.query(func.count(Application.id))
            .filter(Application.tenant_id == tenant_id, Application.status == stage)
            .scalar() or 0
        )
        prev_count = stages[-1]["count"] if stages else total_apps
        conversion_rate = round((count / prev_count * 100), 1) if prev_count > 0 else 0.0
        stages.append({"stage": stage, "count": count, "conversion_rate": conversion_rate})
    return {"stages": stages}


# --- Resume Parser ---
def list_resumes(
    db: Session, tenant_id: str, page: int, page_size: int, candidate_id: Optional[str] = None
) -> dict:
    q = db.query(Resume).filter(Resume.tenant_id == tenant_id)
    if candidate_id:
        q = q.filter(Resume.candidate_id == candidate_id)
    q = q.order_by(Resume.created_at.desc())
    total = q.count()
    items = apply_pagination(q, page, page_size).all()
    return paginated_response([serialize_uuid(r) for r in items], total, page, page_size)


def create_resume(db: Session, tenant_id: str, data: schemas.ResumeCreate) -> dict:
    resume = Resume(tenant_id=tenant_id, **data.model_dump())
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return serialize_uuid(resume)


def get_resume(db: Session, resume_id: str, tenant_id: str) -> Optional[dict]:
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.tenant_id == tenant_id).first()
    if not resume:
        return None
    return serialize_uuid(resume)


def parse_resume_text(raw_text: str) -> dict:
    skills_keywords = [
        "python", "java", "javascript", "typescript", "go", "rust", "c++", "c#",
        "react", "angular", "vue", "node.js", "django", "flask", "spring",
        "sql", "nosql", "mongodb", "postgresql", "mysql", "redis",
        "docker", "kubernetes", "aws", "azure", "gcp", "terraform",
        "git", "ci/cd", "jenkins", "agile", "scrum",
        "machine learning", "deep learning", "nlp", "data analysis",
        "communication", "leadership", "project management",
    ]
    text_lower = raw_text.lower()
    found_skills = [s for s in skills_keywords if s in text_lower]

    exp_keywords = ["experience", "years", "yr"]
    lines = raw_text.split("\n")
    exp_years = 0.0
    for line in lines:
        line_lower = line.lower()
        if any(kw in line_lower for kw in exp_keywords):
            matches = re.findall(r"(\d+)\s*\+?\s*(?:years?|yrs?)", line_lower)
            if matches:
                exp_years = max(exp_years, float(max(matches)))

    edu_levels = [
        "phd",
        "ph.d",
        "doctorate",
        "master",
        "m.s",
        "m.a",
        "bachelor",
        "b.s",
        "b.a",
        "high school",
        "associate"]
    edu_found = "Not specified"
    for level in edu_levels:
        if level in text_lower:
            edu_found = level.upper()
            break

    cert_keywords = ["certified", "certification", "certificate", "aws certified", "pmp", "scrum master", "cpa", "cfa"]
    found_certs = [c for c in cert_keywords if c in text_lower]

    language_list = [
        "english",
        "spanish",
        "french",
        "german",
        "mandarin",
        "japanese",
        "korean",
        "hindi",
        "arabic",
        "portuguese"]
    found_langs = [lang.capitalize() for lang in language_list if lang in text_lower]

    sentences = [s.strip() for s in raw_text.split(".") if len(s.strip()) > 20]
    summary = sentences[0] if sentences else ""

    return {
        "skills": found_skills,
        "experience_years": exp_years,
        "education": edu_found,
        "certifications": found_certs,
        "languages": found_langs,
        "summary": summary,
    }


# --- AI Resume Ranking ---
def rank_candidates_for_job(db: Session, tenant_id: str, job_id: str, candidate_ids: list[str]) -> dict:
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tenant_id).first()
    if not job:
        return None

    job_skills = set()
    if job.requirements:
        for word in job.requirements.lower().split():
            word = word.strip(".,;:!?()[]{}")
            if len(word) > 2:
                job_skills.add(word)

    for cid in candidate_ids:
        candidate = db.query(Candidate).filter(Candidate.id == cid, Candidate.tenant_id == tenant_id).first()
        if not candidate:
            continue

        candidate_skills = set(s.lower() for s in (candidate.skills or []))
        skills_overlap = job_skills & candidate_skills
        skills_match = round(len(skills_overlap) / max(len(job_skills), 1) * 100, 2)

        exp_match = 0.0
        if candidate.experience_years and job.requirements:
            exp_match = round(min(float(candidate.experience_years) / 5.0, 1.0) * 100, 2)

        edu_match = 50.0

        overall = round((skills_match * 0.5 + exp_match * 0.3 + edu_match * 0.2), 2)

        existing = db.query(ResumeRanking).filter(
            ResumeRanking.job_id == job_id, ResumeRanking.candidate_id == cid
        ).first()
        if existing:
            existing.match_score = overall
            existing.skills_match = skills_match
            existing.experience_match = exp_match
            existing.education_match = edu_match
            existing.ai_notes = f"Skills: {len(skills_overlap)} shared keywords"
        else:
            ranking = ResumeRanking(
                tenant_id=tenant_id,
                job_id=job_id,
                candidate_id=cid,
                match_score=overall,
                skills_match=skills_match,
                experience_match=exp_match,
                education_match=edu_match,
                ai_notes=f"Skills: {len(skills_overlap)} shared keywords",
            )
            db.add(ranking)
        db.commit()

    all_rankings = (
        db.query(ResumeRanking)
        .filter(ResumeRanking.job_id == job_id)
        .order_by(ResumeRanking.match_score.desc())
        .all()
    )
    for i, r in enumerate(all_rankings, 1):
        r.rank = i
    db.commit()

    result = []
    for r in all_rankings:
        c = db.query(Candidate).filter(Candidate.id == r.candidate_id).first()
        result.append({
            "candidate_id": str(r.candidate_id),
            "candidate_name": f"{c.first_name} {c.last_name}" if c else "Unknown",
            "match_score": float(r.match_score),
            "skills_match": float(r.skills_match),
            "experience_match": float(r.experience_match),
            "education_match": float(r.education_match),
            "ai_notes": r.ai_notes,
        })

    return {
        "job_id": str(job_id),
        "job_title": job.title,
        "rankings": result,
    }


def score_candidate_for_job(db: Session, tenant_id: str, candidate_id: str, job_id: str) -> dict:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.tenant_id == tenant_id).first()
    if not candidate:
        return None

    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tenant_id).first()
    if not job:
        return None

    job_skills = set()
    if job.requirements:
        for word in job.requirements.lower().split():
            word = word.strip(".,;:!?()[]{}")
            if len(word) > 2:
                job_skills.add(word)

    candidate_skills = set(s.lower() for s in (candidate.skills or []))
    skill_overlap = job_skills & candidate_skills
    skill_score = round(len(skill_overlap) / max(len(job_skills), 1) * 100, 2)

    exp_score = 0.0
    if candidate.experience_years:
        exp_score = round(min(float(candidate.experience_years) / 5.0, 1.0) * 100, 2)

    edu_levels = {"phd": 100, "master": 80, "bachelor": 60, "associate": 40, "high school": 20}
    edu_score = 0.0
    if candidate.education_level:
        edu_score = edu_levels.get(candidate.education_level.lower(), 50.0)

    overall = round(skill_score * 0.4 + exp_score * 0.35 + edu_score * 0.25, 2)

    return {
        "candidate_id": str(candidate_id),
        "job_id": str(job_id),
        "overall_score": overall,
        "skill_score": skill_score,
        "experience_score": exp_score,
        "education_score": edu_score,
        "culture_score": 70.0,
        "breakdown": {
            "shared_skills": list(skill_overlap),
            "experience_years": float(candidate.experience_years or 0),
            "education_level": candidate.education_level or "N/A",
            "total_job_requirements": len(job_skills),
        },
    }


# --- Offer Templates ---
def list_offer_templates(db: Session, tenant_id: str, page: int, page_size: int) -> dict:
    q = db.query(OfferTemplate).filter(OfferTemplate.tenant_id == tenant_id).order_by(OfferTemplate.created_at.desc())
    total = q.count()
    items = apply_pagination(q, page, page_size).all()
    return paginated_response([serialize_uuid(t) for t in items], total, page, page_size)


def create_offer_template(db: Session, tenant_id: str, data: schemas.OfferTemplateCreate) -> dict:
    if data.is_default:
        db.query(OfferTemplate).filter(OfferTemplate.tenant_id == tenant_id,
                                       OfferTemplate.is_default.is_(True)).update({"is_default": False})
    template = OfferTemplate(tenant_id=tenant_id, **data.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return serialize_uuid(template)


def get_offer_template(db: Session, template_id: str, tenant_id: str) -> Optional[dict]:
    t = db.query(OfferTemplate).filter(OfferTemplate.id == template_id, OfferTemplate.tenant_id == tenant_id).first()
    if not t:
        return None
    return serialize_uuid(t)


def update_offer_template(db: Session, template_id: str, tenant_id: str,
                          data: schemas.OfferTemplateUpdate) -> Optional[dict]:
    t = db.query(OfferTemplate).filter(OfferTemplate.id == template_id, OfferTemplate.tenant_id == tenant_id).first()
    if not t:
        return None
    update_data = data.model_dump(exclude_none=True)
    if data.is_default:
        db.query(OfferTemplate).filter(OfferTemplate.tenant_id == tenant_id,
                                       OfferTemplate.is_default.is_(True)).update({"is_default": False})
    for key, value in update_data.items():
        setattr(t, key, value)
    t.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(t)
    return serialize_uuid(t)


def delete_offer_template(db: Session, template_id: str, tenant_id: str) -> bool:
    t = db.query(OfferTemplate).filter(OfferTemplate.id == template_id, OfferTemplate.tenant_id == tenant_id).first()
    if not t:
        return False
    db.delete(t)
    db.commit()
    return True


def generate_offer_letter(
    db: Session, tenant_id: str, offer_id: str, template_id: str, extra_vars: Optional[dict] = None
) -> Optional[dict]:
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == tenant_id).first()
    if not offer:
        return None
    template = db.query(OfferTemplate).filter(OfferTemplate.id == template_id).first()
    if not template:
        t = db.query(OfferTemplate).filter(
            OfferTemplate.tenant_id == tenant_id,
            OfferTemplate.is_default.is_(True)).first()
        if not t:
            return None
        template = t

    app = db.query(Application).filter(Application.id == offer.application_id).first()
    candidate = db.query(Candidate).filter(Candidate.id == app.candidate_id).first() if app else None
    job = db.query(Job).filter(Job.id == app.job_id).first() if app else None

    variables = {
        "candidate_name": f"{candidate.first_name} {candidate.last_name}" if candidate else "{{candidate_name}}",
        "job_title": job.title if job else "{{job_title}}",
        "department": job.department if job else "{{department}}",
        "start_date": str(offer.start_date) if offer.start_date else "{{start_date}}",
        "base_salary": f"${float(offer.base_salary):,.2f}" if offer.base_salary else "{{base_salary}}",
        "signing_bonus": f"${float(offer.signing_bonus):,.2f}" if offer.signing_bonus else "{{signing_bonus}}",
        "company_name": "Atlas Workforce Systems",
    }
    if extra_vars:
        variables.update(extra_vars)

    subject = template.subject or "Offer Letter"
    body = template.body_template or ""
    for key, val in variables.items():
        placeholder = "{{" + key + "}}"
        subject = subject.replace(placeholder, str(val))
        body = body.replace(placeholder, str(val))

    return {"subject": subject, "body": body}


# --- Campus Recruitment ---
def list_campus_drives(
    db: Session, tenant_id: str, page: int, page_size: int, status: Optional[str] = None
) -> dict:
    q = db.query(CampusDrive).filter(CampusDrive.tenant_id == tenant_id)
    if status:
        q = q.filter(CampusDrive.status == status)
    q = q.order_by(CampusDrive.drive_date.desc())
    total = q.count()
    items = apply_pagination(q, page, page_size).all()
    result = []
    for drive in items:
        d = serialize_uuid(drive)
        d["registration_count"] = db.query(func.count(CampusRegistration.id)).filter(
            CampusRegistration.drive_id == drive.id
        ).scalar() or 0
        result.append(d)
    return paginated_response(result, total, page, page_size)


def create_campus_drive(db: Session, tenant_id: str, data: schemas.CampusDriveCreate) -> dict:
    drive = CampusDrive(tenant_id=tenant_id, **data.model_dump())
    db.add(drive)
    db.commit()
    db.refresh(drive)
    return serialize_uuid(drive)


def get_campus_drive(db: Session, drive_id: str, tenant_id: str) -> Optional[dict]:
    drive = db.query(CampusDrive).filter(CampusDrive.id == drive_id, CampusDrive.tenant_id == tenant_id).first()
    if not drive:
        return None
    d = serialize_uuid(drive)
    d["registration_count"] = db.query(func.count(CampusRegistration.id)).filter(
        CampusRegistration.drive_id == drive.id
    ).scalar() or 0
    return d


def update_campus_drive(db: Session, drive_id: str, tenant_id: str, data: schemas.CampusDriveUpdate) -> Optional[dict]:
    drive = db.query(CampusDrive).filter(CampusDrive.id == drive_id, CampusDrive.tenant_id == tenant_id).first()
    if not drive:
        return None
    update_data = data.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(drive, key, value)
    drive.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(drive)
    return serialize_uuid(drive)


def delete_campus_drive(db: Session, drive_id: str, tenant_id: str) -> bool:
    drive = db.query(CampusDrive).filter(CampusDrive.id == drive_id, CampusDrive.tenant_id == tenant_id).first()
    if not drive:
        return False
    db.delete(drive)
    db.commit()
    return True


def list_campus_registrations(
    db: Session, tenant_id: str, page: int, page_size: int, drive_id: Optional[str] = None
) -> dict:
    q = db.query(CampusRegistration).filter(CampusRegistration.tenant_id == tenant_id)
    if drive_id:
        q = q.filter(CampusRegistration.drive_id == drive_id)
    q = q.order_by(CampusRegistration.created_at.desc())
    total = q.count()
    items = apply_pagination(q, page, page_size).all()
    return paginated_response([serialize_uuid(r) for r in items], total, page, page_size)


def create_campus_registration(db: Session, tenant_id: str, data: schemas.CampusRegistrationCreate) -> Optional[dict]:
    drive = db.query(CampusDrive).filter(CampusDrive.id == data.drive_id).first()
    if not drive:
        return None

    existing_candidate = db.query(Candidate).filter(
        Candidate.email == data.email, Candidate.tenant_id == tenant_id
    ).first()
    candidate_id = None
    if not existing_candidate:
        candidate = Candidate(
            tenant_id=tenant_id,
            first_name=data.first_name,
            last_name=data.last_name,
            email=data.email,
            phone=data.phone,
            source="CAMPUS",
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        candidate_id = candidate.id
    else:
        candidate_id = existing_candidate.id

    reg = CampusRegistration(tenant_id=tenant_id, candidate_id=candidate_id, **data.model_dump())
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return serialize_uuid(reg)


def update_campus_registration(db: Session, reg_id: str, tenant_id: str,
                               data: schemas.CampusRegistrationUpdate) -> Optional[dict]:
    reg = db.query(CampusRegistration).filter(
        CampusRegistration.id == reg_id,
        CampusRegistration.tenant_id == tenant_id).first()
    if not reg:
        return None
    update_data = data.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(reg, key, value)
    db.commit()
    db.refresh(reg)
    return serialize_uuid(reg)


# --- Referral Management ---
def list_referrals(
    db: Session, tenant_id: str, page: int, page_size: int, status: Optional[str] = None
) -> dict:
    q = db.query(Referral).filter(Referral.tenant_id == tenant_id)
    if status:
        q = q.filter(Referral.status == status)
    q = q.order_by(Referral.created_at.desc())
    total = q.count()
    items = apply_pagination(q, page, page_size).all()
    return paginated_response([serialize_uuid(r) for r in items], total, page, page_size)


def create_referral(db: Session, tenant_id: str, data: schemas.ReferralCreate) -> dict:
    existing_candidate = db.query(Candidate).filter(
        Candidate.email == data.email, Candidate.tenant_id == tenant_id
    ).first()
    candidate_id = None
    if not existing_candidate:
        candidate = Candidate(
            tenant_id=tenant_id,
            first_name=data.first_name,
            last_name=data.last_name,
            email=data.email,
            phone=data.phone,
            source="REFERRAL",
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        candidate_id = candidate.id
    else:
        candidate_id = existing_candidate.id

    referral = Referral(tenant_id=tenant_id, candidate_id=candidate_id, **data.model_dump())
    db.add(referral)
    db.commit()
    db.refresh(referral)
    return serialize_uuid(referral)


def get_referral(db: Session, referral_id: str, tenant_id: str) -> Optional[dict]:
    r = db.query(Referral).filter(Referral.id == referral_id, Referral.tenant_id == tenant_id).first()
    if not r:
        return None
    return serialize_uuid(r)


def update_referral(db: Session, referral_id: str, tenant_id: str, data: schemas.ReferralUpdate) -> Optional[dict]:
    r = db.query(Referral).filter(Referral.id == referral_id, Referral.tenant_id == tenant_id).first()
    if not r:
        return None
    update_data = data.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(r, key, value)
    db.commit()
    db.refresh(r)
    return serialize_uuid(r)


def get_referral_stats(db: Session, tenant_id: str) -> dict:
    total = db.query(func.count(Referral.id)).filter(Referral.tenant_id == tenant_id).scalar() or 0
    pending = db.query(
        func.count(
            Referral.id)).filter(
        Referral.tenant_id == tenant_id,
        Referral.status == "PENDING").scalar() or 0
    contacted = db.query(
        func.count(
            Referral.id)).filter(
        Referral.tenant_id == tenant_id,
        Referral.status == "CONTACTED").scalar() or 0
    applied = db.query(
        func.count(
            Referral.id)).filter(
        Referral.tenant_id == tenant_id,
        Referral.status == "APPLIED").scalar() or 0
    interviewing = db.query(
        func.count(
            Referral.id)).filter(
        Referral.tenant_id == tenant_id,
        Referral.status == "INTERVIEWING").scalar() or 0
    hired = db.query(
        func.count(
            Referral.id)).filter(
        Referral.tenant_id == tenant_id,
        Referral.status == "HIRED").scalar() or 0
    total_amount = db.query(func.coalesce(func.sum(Referral.reward_amount), 0)).filter(
        Referral.tenant_id == tenant_id
    ).scalar() or 0
    total_paid = db.query(func.coalesce(func.sum(Referral.reward_amount), 0)).filter(
        Referral.tenant_id == tenant_id, Referral.reward_paid.is_(True)
    ).scalar() or 0

    top = (
        db.query(Referral.referrer_employee_id, func.count(Referral.id))
        .filter(Referral.tenant_id == tenant_id, Referral.status == "HIRED")
        .group_by(Referral.referrer_employee_id)
        .order_by(func.count(Referral.id).desc())
        .limit(5)
        .all()
    )
    top_referrers = [{"employee_id": eid, "hired_count": cnt} for eid, cnt in top]

    return {
        "total_referrals": total,
        "pending": pending,
        "contacted": contacted,
        "applied": applied,
        "interviewing": interviewing,
        "hired": hired,
        "total_reward_amount": float(total_amount),
        "total_reward_paid": float(total_paid),
        "top_referrers": top_referrers,
    }


# --- Recruitment Chatbot ---
def create_chatbot_session(db: Session, tenant_id: str, data: schemas.ChatbotSessionCreate) -> dict:
    session = ChatbotSession(tenant_id=tenant_id, **data.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return serialize_uuid(session)


def get_chatbot_session(db: Session, session_id: str, tenant_id: str) -> Optional[dict]:
    session = db.query(ChatbotSession).filter(
        ChatbotSession.id == session_id,
        ChatbotSession.tenant_id == tenant_id).first()
    if not session:
        return None
    d = serialize_uuid(session)
    d["messages"] = [serialize_uuid(m) for m in (session.messages or [])]
    return d


def close_chatbot_session(db: Session, session_id: str, tenant_id: str) -> Optional[dict]:
    session = db.query(ChatbotSession).filter(
        ChatbotSession.id == session_id,
        ChatbotSession.tenant_id == tenant_id).first()
    if not session:
        return None
    session.status = "CLOSED"
    session.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(session)
    return serialize_uuid(session)


INTENT_RESPONSES = {
    "greeting": (
        "Hello! Welcome to Atlas Careers. I can help you find job openings, "
        "check application status, or answer questions about our hiring process. "
        "How can I help you today?"
    ),
    "jobs": (
        "We have various open positions across Engineering, Sales, Marketing, "
        "and Operations. Could you tell me which department you're interested in?"
    ),
    "application_status": (
        "To check your application status, please provide your email address "
        "or application ID and I'll look it up for you."
    ),
    "interview": (
        "Our interview process typically includes: 1) Phone Screen, "
        "2) Technical Interview, 3) Cultural Fit, and 4) Final Round "
        "with the hiring manager."
    ),
    "benefits": (
        "We offer competitive salaries, health insurance, 401k matching, "
        "flexible work hours, remote work options, professional development "
        "budget, and annual bonuses."
    ),
    "process": (
        "Our hiring process: 1) Submit application, 2) Resume screening, "
        "3) Phone interview, 4) Technical assessment, 5) On-site interviews, "
        "6) Offer extended."
    ),
    "contact": (
        "You can reach our recruitment team at careers@atlas.io or "
        "call +1 (555) 123-4567. We're available Mon-Fri 9AM-6PM EST."
    ),
    "farewell": (
        "Thank you for your interest in Atlas! Feel free to come back anytime "
        "if you have more questions. Good luck with your application!"
    ),
    "unknown": (
        "I'm not sure I understand. Could you rephrase your question? "
        "You can ask me about job openings, the application process, "
        "interview tips, or company benefits."
    ),
}


def detect_intent(message: str) -> str:
    text = message.lower()
    if any(w in text for w in ["hi", "hello", "hey", "greetings"]):
        return "greeting"
    if any(w in text for w in ["job", "opening", "position", "vacancy", "hire"]):
        return "jobs"
    if any(w in text for w in ["status", "application", "applied", "track"]):
        return "application_status"
    if any(w in text for w in ["interview", "round", "onsite", "phone screen"]):
        return "interview"
    if any(w in text for w in ["benefit", "salary", "perk", "insurance", "vacation", "holiday"]):
        return "benefits"
    if any(w in text for w in ["process", "step", "how to apply", "procedure"]):
        return "process"
    if any(w in text for w in ["contact", "reach", "call", "email", "phone", "support"]):
        return "contact"
    if any(w in text for w in ["bye", "goodbye", "thanks", "thank you", "see you"]):
        return "farewell"
    return "unknown"


def send_chatbot_message(db: Session, session_id: str, tenant_id: str, content: str) -> Optional[dict]:
    session = db.query(ChatbotSession).filter(
        ChatbotSession.id == session_id,
        ChatbotSession.tenant_id == tenant_id).first()
    if not session or session.status == "CLOSED":
        return None

    user_msg = ChatbotMessage(session_id=session.id, role="user", content=content)
    db.add(user_msg)

    intent = detect_intent(content)
    reply_text = INTENT_RESPONSES.get(intent, INTENT_RESPONSES["unknown"])

    bot_msg = ChatbotMessage(session_id=session.id, role="assistant", content=reply_text, intent=intent)
    db.add(bot_msg)

    session.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(bot_msg)
    return serialize_uuid(bot_msg)


# --- Enhanced Analytics ---
def get_recruitment_analytics(db: Session, tenant_id: str) -> dict:
    total_jobs = db.query(func.count(Job.id)).filter(Job.tenant_id == tenant_id).scalar() or 0
    active_jobs = db.query(
        func.count(
            Job.id)).filter(
        Job.tenant_id == tenant_id,
        Job.status == "PUBLISHED").scalar() or 0
    total_candidates = db.query(func.count(Candidate.id)).filter(Candidate.tenant_id == tenant_id).scalar() or 0
    total_applications = db.query(func.count(Application.id)).filter(Application.tenant_id == tenant_id).scalar() or 0
    total_interviews = db.query(func.count(Interview.id)).filter(Interview.tenant_id == tenant_id).scalar() or 0
    total_offers = db.query(func.count(Offer.id)).filter(Offer.tenant_id == tenant_id).scalar() or 0
    accepted_offers = db.query(
        func.count(
            Offer.id)).filter(
        Offer.tenant_id == tenant_id,
        Offer.status == "ACCEPTED").scalar() or 0
    offer_acceptance_rate = round((accepted_offers / max(total_offers, 1)) * 100, 1)

    avg_time = (
        db.query(func.avg(
            func.extract("epoch", Application.updated_at - Application.application_date) / 86400.0
        ))
        .filter(Application.tenant_id == tenant_id, Application.status.in_(["HIRED", "OFFER_ACCEPTED"]))
        .scalar()
    )
    average_time_to_hire_days = round(float(avg_time), 1) if avg_time else 0.0

    stages_order = ["APPLIED", "SCREENING", "INTERVIEW_STAGE_1", "INTERVIEW_STAGE_2",
                    "FINAL_INTERVIEW", "OFFER_EXTENDED", "OFFER_ACCEPTED", "HIRED"]
    funnel = []
    total_apps_for_funnel = total_applications or 1
    prev_count = total_apps_for_funnel
    for stage in stages_order:
        count = db.query(func.count(Application.id)).filter(
            Application.tenant_id == tenant_id, Application.status == stage
        ).scalar() or 0
        funnel.append({
            "stage": stage, "count": count,
            "conversion_rate": round((count / max(prev_count, 1)) * 100, 1),
        })
        prev_count = count

    sources = (
        db.query(Candidate.source, func.count(Candidate.id))
        .filter(Candidate.tenant_id == tenant_id)
        .group_by(Candidate.source)
        .all()
    )
    source_breakdown = [{"source": s or "OTHER", "count": c} for s, c in sources]

    dept_demand = (
        db.query(Job.department, func.count(Job.id))
        .filter(Job.tenant_id == tenant_id, Job.status == "PUBLISHED")
        .group_by(Job.department)
        .all()
    )
    department_demand = [{"department": d, "open_positions": c} for d, c in dept_demand if d]

    monthly = (
        db.query(
            func.date_trunc("month", Application.created_at).label("month"),
            func.count(Application.id),
        )
        .filter(Application.tenant_id == tenant_id)
        .group_by(func.date_trunc("month", Application.created_at))
        .order_by(func.date_trunc("month", Application.created_at).desc())
        .limit(12)
        .all()
    )
    monthly_trend = [{"month": str(m), "count": c} for m, c in monthly]

    return {
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "total_candidates": total_candidates,
        "total_applications": total_applications,
        "total_interviews": total_interviews,
        "total_offers": total_offers,
        "accepted_offers": accepted_offers,
        "offer_acceptance_rate": offer_acceptance_rate,
        "average_time_to_hire_days": average_time_to_hire_days,
        "conversion_funnel": funnel,
        "source_breakdown": source_breakdown,
        "department_demand": department_demand,
        "monthly_trend": monthly_trend,
    }


def get_hiring_pipeline(db: Session, tenant_id: str) -> dict:
    active_jobs = db.query(
        func.count(
            Job.id)).filter(
        Job.tenant_id == tenant_id,
        Job.status == "PUBLISHED").scalar() or 0
    total_candidates = db.query(func.count(Candidate.id)).filter(Candidate.tenant_id == tenant_id).scalar() or 0
    active_candidates = db.query(func.count(Candidate.id)).filter(
        Candidate.tenant_id == tenant_id, Candidate.status.in_(["NEW", "SCREENING", "INTERVIEWING"])
    ).scalar() or 0
    interviews_scheduled = db.query(func.count(Interview.id)).filter(
        Interview.tenant_id == tenant_id, Interview.status == "SCHEDULED"
    ).scalar() or 0
    offers_extended = db.query(func.count(Offer.id)).filter(
        Offer.tenant_id == tenant_id, Offer.status == "SENT"
    ).scalar() or 0
    offers_accepted = db.query(func.count(Offer.id)).filter(
        Offer.tenant_id == tenant_id, Offer.status == "ACCEPTED"
    ).scalar() or 0

    pipeline_stages = [
        {"stage": "Applied", "count": db.query(func.count(Application.id)).filter(
            Application.tenant_id == tenant_id, Application.status == "APPLIED").scalar() or 0},
        {"stage": "Screening", "count": db.query(func.count(Application.id)).filter(
            Application.tenant_id == tenant_id, Application.status == "SCREENING").scalar() or 0},
        {"stage": "Interview", "count": db.query(func.count(Application.id)).filter(
            Application.tenant_id == tenant_id, Application.status.like("INTERVIEW%")).scalar() or 0},
        {"stage": "Offer", "count": db.query(func.count(Application.id)).filter(
            Application.tenant_id == tenant_id, Application.status.like("OFFER%")).scalar() or 0},
        {"stage": "Hired", "count": db.query(func.count(Application.id)).filter(
            Application.tenant_id == tenant_id, Application.status == "HIRED").scalar() or 0},
    ]

    upcoming = (
        db.query(Interview)
        .filter(Interview.tenant_id == tenant_id, Interview.status == "SCHEDULED")
        .order_by(Interview.scheduled_at.asc())
        .limit(10)
        .all()
    )
    upcoming_interviews = []
    for iv in upcoming:
        c = None
        if iv.application and iv.application.candidate:
            c = iv.application.candidate
        upcoming_interviews.append({
            "id": str(iv.id),
            "candidate_name": f"{c.first_name} {c.last_name}" if c else "Unknown",
            "interview_type": iv.interview_type,
            "scheduled_at": iv.scheduled_at.isoformat() if iv.scheduled_at else None,
            "interviewer_id": iv.interviewer_id,
        })

    recent = (
        db.query(Application)
        .filter(Application.tenant_id == tenant_id)
        .order_by(Application.updated_at.desc())
        .limit(10)
        .all()
    )
    recent_activities = []
    for app in recent:
        recent_activities.append({
            "application_id": str(app.id),
            "candidate_name": f"{app.candidate.first_name} {app.candidate.last_name}" if app.candidate else "Unknown",
            "job_title": app.job.title if app.job else "Unknown",
            "status": app.status,
            "updated_at": app.updated_at.isoformat() if app.updated_at else None,
        })

    return {
        "active_jobs": active_jobs,
        "total_candidates": total_candidates,
        "active_candidates": active_candidates,
        "interviews_scheduled": interviews_scheduled,
        "offers_extended": offers_extended,
        "offers_accepted": offers_accepted,
        "pipeline_stages": pipeline_stages,
        "upcoming_interviews": upcoming_interviews,
        "recent_activities": recent_activities,
    }
