import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import or_, func, and_, text
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import UUID

from models import Job, Candidate, Application, Interview, Offer
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
        {"event": "Application submitted", "field": None, "old_value": None, "new_value": None, "timestamp": app.created_at.isoformat() if app.created_at else None},
        {"event": f"Status changed to {app.status}", "field": "status", "old_value": None, "new_value": app.status, "timestamp": app.updated_at.isoformat() if app.updated_at else None},
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
    for key, value in update_data.items():
        setattr(interview, key, value)
    interview.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(interview)
    return serialize_uuid(interview)


def submit_interview_feedback(db: Session, interview_id: str, tenant_id: str, data: schemas.InterviewFeedback) -> Optional[dict]:
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
    stages_order = ["APPLIED", "SCREENING", "INTERVIEW_STAGE_1", "INTERVIEW_STAGE_2", "FINAL_INTERVIEW", "OFFER_EXTENDED", "OFFER_ACCEPTED", "HIRED"]
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
