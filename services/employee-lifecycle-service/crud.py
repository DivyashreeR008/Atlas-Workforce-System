from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from models import (
    CareerFramework, CareerPath, EmployeeAchievement, EmployeeDocument,
    EmployeeProfile, EmployeeTimelineEvent, ExitInterview,
    InternalApplication, InternalJobPosting, JobFamily,
    OffboardingRecord, OnboardingAssignment, OnboardingTemplate,
    ProbationAssessment, ProbationRecord, PromotionRequest,
    CareerRoadmap, TransferRequest,
)


def _paginate(query, page: int, page_size: int):
    total = query.count()
    items = query.order_by(None).offset((page - 1) * page_size).limit(page_size).all() if total else []
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def _now():
    return datetime.now(timezone.utc)


# ── Onboarding Templates ──────────────────────────────────────────

def list_onboarding_templates(db: Session, tenant_id: str, page: int, page_size: int, is_active: Optional[bool] = None):
    q = db.query(OnboardingTemplate).filter(OnboardingTemplate.tenant_id == tenant_id)
    if is_active is not None:
        q = q.filter(OnboardingTemplate.is_active == is_active)
    q = q.order_by(OnboardingTemplate.name)
    return _paginate(q, page, page_size)

def get_onboarding_template(db: Session, template_id: UUID, tenant_id: str):
    return db.query(OnboardingTemplate).filter(OnboardingTemplate.id == template_id, OnboardingTemplate.tenant_id == tenant_id).first()

def create_onboarding_template(db: Session, tenant_id: str, data: dict):
    obj = OnboardingTemplate(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def update_onboarding_template(db: Session, template_id: UUID, tenant_id: str, data: dict):
    obj = get_onboarding_template(db, template_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj

def delete_onboarding_template(db: Session, template_id: UUID, tenant_id: str) -> bool:
    obj = get_onboarding_template(db, template_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


# ── Onboarding Assignments ────────────────────────────────────────

def list_onboarding_assignments(db: Session, tenant_id: str, page: int, page_size: int, employee_id: Optional[str] = None, status: Optional[str] = None):
    q = db.query(OnboardingAssignment).filter(OnboardingAssignment.tenant_id == tenant_id)
    if employee_id: q = q.filter(OnboardingAssignment.employee_id == employee_id)
    if status: q = q.filter(OnboardingAssignment.status == status)
    q = q.order_by(OnboardingAssignment.created_at.desc())
    return _paginate(q, page, page_size)

def get_onboarding_assignment(db: Session, assign_id: UUID, tenant_id: str):
    return db.query(OnboardingAssignment).filter(OnboardingAssignment.id == assign_id, OnboardingAssignment.tenant_id == tenant_id).first()

def create_onboarding_assignment(db: Session, tenant_id: str, data: dict):
    obj = OnboardingAssignment(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def update_onboarding_assignment(db: Session, assign_id: UUID, tenant_id: str, data: dict):
    obj = get_onboarding_assignment(db, assign_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    if data.get("status") == "COMPLETED": obj.completed_at = _now()
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj

def delete_onboarding_assignment(db: Session, assign_id: UUID, tenant_id: str) -> bool:
    obj = get_onboarding_assignment(db, assign_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


# ── Offboarding Records ───────────────────────────────────────────

def list_offboarding_records(db: Session, tenant_id: str, page: int, page_size: int, employee_id: Optional[str] = None, status: Optional[str] = None):
    q = db.query(OffboardingRecord).filter(OffboardingRecord.tenant_id == tenant_id)
    if employee_id: q = q.filter(OffboardingRecord.employee_id == employee_id)
    if status: q = q.filter(OffboardingRecord.status == status)
    q = q.order_by(OffboardingRecord.created_at.desc())
    return _paginate(q, page, page_size)

def get_offboarding_record(db: Session, record_id: UUID, tenant_id: str):
    return db.query(OffboardingRecord).filter(OffboardingRecord.id == record_id, OffboardingRecord.tenant_id == tenant_id).first()

def create_offboarding_record(db: Session, tenant_id: str, data: dict):
    obj = OffboardingRecord(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def update_offboarding_record(db: Session, record_id: UUID, tenant_id: str, data: dict):
    obj = get_offboarding_record(db, record_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


# ── Exit Interviews ───────────────────────────────────────────────

def create_exit_interview(db: Session, tenant_id: str, data: dict):
    obj = ExitInterview(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj)
    db.query(OffboardingRecord).filter(OffboardingRecord.id == obj.offboarding_id).update({"exit_interview_completed": True})
    db.commit(); return obj

def get_exit_interview(db: Session, interview_id: UUID, tenant_id: str):
    return db.query(ExitInterview).filter(ExitInterview.id == interview_id, ExitInterview.tenant_id == tenant_id).first()

def get_exit_interview_by_offboarding(db: Session, offboarding_id: UUID, tenant_id: str):
    return db.query(ExitInterview).filter(ExitInterview.offboarding_id == offboarding_id, ExitInterview.tenant_id == tenant_id).first()


# ── Probation Records ─────────────────────────────────────────────

def list_probation_records(db: Session, tenant_id: str, page: int, page_size: int, employee_id: Optional[str] = None, status: Optional[str] = None):
    q = db.query(ProbationRecord).filter(ProbationRecord.tenant_id == tenant_id)
    if employee_id: q = q.filter(ProbationRecord.employee_id == employee_id)
    if status: q = q.filter(ProbationRecord.status == status)
    q = q.order_by(ProbationRecord.start_date.desc())
    return _paginate(q, page, page_size)

def get_probation_record(db: Session, record_id: UUID, tenant_id: str):
    return db.query(ProbationRecord).filter(ProbationRecord.id == record_id, ProbationRecord.tenant_id == tenant_id).first()

def get_probation_by_employee(db: Session, employee_id: str, tenant_id: str):
    return db.query(ProbationRecord).filter(ProbationRecord.employee_id == employee_id, ProbationRecord.tenant_id == tenant_id).order_by(ProbationRecord.created_at.desc()).first()

def create_probation_record(db: Session, tenant_id: str, data: dict):
    obj = ProbationRecord(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def update_probation_record(db: Session, record_id: UUID, tenant_id: str, data: dict):
    obj = get_probation_record(db, record_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


# ── Probation Assessments ─────────────────────────────────────────

def list_probation_assessments(db: Session, tenant_id: str, probation_id: Optional[UUID] = None, page: int = 1, page_size: int = 20):
    q = db.query(ProbationAssessment).filter(ProbationAssessment.tenant_id == tenant_id)
    if probation_id: q = q.filter(ProbationAssessment.probation_id == probation_id)
    q = q.order_by(ProbationAssessment.assessment_date.desc())
    return _paginate(q, page, page_size)

def create_probation_assessment(db: Session, tenant_id: str, data: dict):
    obj = ProbationAssessment(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def update_probation_assessment(db: Session, assess_id: UUID, tenant_id: str, data: dict):
    obj = db.query(ProbationAssessment).filter(ProbationAssessment.id == assess_id, ProbationAssessment.tenant_id == tenant_id).first()
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    db.commit(); db.refresh(obj); return obj


# ── Career Frameworks ─────────────────────────────────────────────

def list_career_frameworks(db: Session, tenant_id: str, page: int = 1, page_size: int = 20):
    q = db.query(CareerFramework).filter(CareerFramework.tenant_id == tenant_id).order_by(CareerFramework.name)
    return _paginate(q, page, page_size)

def create_career_framework(db: Session, tenant_id: str, data: dict):
    obj = CareerFramework(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def get_career_framework(db: Session, fw_id: UUID, tenant_id: str):
    return db.query(CareerFramework).filter(CareerFramework.id == fw_id, CareerFramework.tenant_id == tenant_id).first()

def update_career_framework(db: Session, fw_id: UUID, tenant_id: str, data: dict):
    obj = get_career_framework(db, fw_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


# ── Job Families ──────────────────────────────────────────────────

def list_job_families(db: Session, tenant_id: str, page: int = 1, page_size: int = 20, framework_id: Optional[UUID] = None):
    q = db.query(JobFamily).filter(JobFamily.tenant_id == tenant_id)
    if framework_id: q = q.filter(JobFamily.framework_id == framework_id)
    q = q.order_by(JobFamily.name)
    return _paginate(q, page, page_size)

def create_job_family(db: Session, tenant_id: str, data: dict):
    obj = JobFamily(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def get_job_family(db: Session, jf_id: UUID, tenant_id: str):
    return db.query(JobFamily).filter(JobFamily.id == jf_id, JobFamily.tenant_id == tenant_id).first()

def update_job_family(db: Session, jf_id: UUID, tenant_id: str, data: dict):
    obj = get_job_family(db, jf_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


# ── Career Paths ──────────────────────────────────────────────────

def list_career_paths(db: Session, tenant_id: str, page: int = 1, page_size: int = 20, job_family_id: Optional[UUID] = None):
    q = db.query(CareerPath).filter(CareerPath.tenant_id == tenant_id)
    if job_family_id: q = q.filter(CareerPath.job_family_id == job_family_id)
    q = q.order_by(CareerPath.name)
    return _paginate(q, page, page_size)

def create_career_path(db: Session, tenant_id: str, data: dict):
    obj = CareerPath(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def get_career_path(db: Session, path_id: UUID, tenant_id: str):
    return db.query(CareerPath).filter(CareerPath.id == path_id, CareerPath.tenant_id == tenant_id).first()

def update_career_path(db: Session, path_id: UUID, tenant_id: str, data: dict):
    obj = get_career_path(db, path_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


# ── Internal Job Postings ─────────────────────────────────────────

def list_internal_jobs(db: Session, tenant_id: str, page: int, page_size: int, status: Optional[str] = None, department: Optional[str] = None):
    q = db.query(InternalJobPosting).filter(InternalJobPosting.tenant_id == tenant_id)
    if status: q = q.filter(InternalJobPosting.status == status)
    if department: q = q.filter(InternalJobPosting.department == department)
    q = q.order_by(InternalJobPosting.created_at.desc())
    return _paginate(q, page, page_size)

def get_internal_job(db: Session, job_id: UUID, tenant_id: str):
    return db.query(InternalJobPosting).filter(InternalJobPosting.id == job_id, InternalJobPosting.tenant_id == tenant_id).first()

def create_internal_job(db: Session, tenant_id: str, data: dict):
    obj = InternalJobPosting(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def update_internal_job(db: Session, job_id: UUID, tenant_id: str, data: dict):
    obj = get_internal_job(db, job_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    if data.get("status") == "PUBLISHED": obj.posted_at = _now()
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj

def delete_internal_job(db: Session, job_id: UUID, tenant_id: str) -> bool:
    obj = get_internal_job(db, job_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


# ── Internal Applications ─────────────────────────────────────────

def list_internal_applications(db: Session, tenant_id: str, page: int, page_size: int, job_id: Optional[UUID] = None, employee_id: Optional[str] = None, status: Optional[str] = None):
    q = db.query(InternalApplication).filter(InternalApplication.tenant_id == tenant_id)
    if job_id: q = q.filter(InternalApplication.job_id == job_id)
    if employee_id: q = q.filter(InternalApplication.employee_id == employee_id)
    if status: q = q.filter(InternalApplication.status == status)
    q = q.order_by(InternalApplication.created_at.desc())
    return _paginate(q, page, page_size)

def create_internal_application(db: Session, tenant_id: str, data: dict):
    obj = InternalApplication(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def update_internal_application(db: Session, app_id: UUID, tenant_id: str, data: dict):
    obj = db.query(InternalApplication).filter(InternalApplication.id == app_id, InternalApplication.tenant_id == tenant_id).first()
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    if data.get("status") in ("APPROVED", "REJECTED"): obj.decided_at = _now()
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


# ── Transfer Requests ─────────────────────────────────────────────

def list_transfer_requests(db: Session, tenant_id: str, page: int, page_size: int, employee_id: Optional[str] = None, status: Optional[str] = None):
    q = db.query(TransferRequest).filter(TransferRequest.tenant_id == tenant_id)
    if employee_id: q = q.filter(TransferRequest.employee_id == employee_id)
    if status: q = q.filter(TransferRequest.status == status)
    q = q.order_by(TransferRequest.created_at.desc())
    return _paginate(q, page, page_size)

def create_transfer_request(db: Session, tenant_id: str, data: dict):
    obj = TransferRequest(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def get_transfer_request(db: Session, transfer_id: UUID, tenant_id: str):
    return db.query(TransferRequest).filter(TransferRequest.id == transfer_id, TransferRequest.tenant_id == tenant_id).first()

def update_transfer_request(db: Session, transfer_id: UUID, tenant_id: str, data: dict):
    obj = get_transfer_request(db, transfer_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    if data.get("status") in ("APPROVED", "REJECTED"): obj.decided_at = _now()
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


# ── Promotion Requests ────────────────────────────────────────────

def list_promotion_requests(db: Session, tenant_id: str, page: int, page_size: int, employee_id: Optional[str] = None, status: Optional[str] = None):
    q = db.query(PromotionRequest).filter(PromotionRequest.tenant_id == tenant_id)
    if employee_id: q = q.filter(PromotionRequest.employee_id == employee_id)
    if status: q = q.filter(PromotionRequest.status == status)
    q = q.order_by(PromotionRequest.created_at.desc())
    return _paginate(q, page, page_size)

def get_promotion_request(db: Session, promo_id: UUID, tenant_id: str):
    return db.query(PromotionRequest).filter(PromotionRequest.id == promo_id, PromotionRequest.tenant_id == tenant_id).first()

def create_promotion_request(db: Session, tenant_id: str, data: dict):
    obj = PromotionRequest(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def update_promotion_request(db: Session, promo_id: UUID, tenant_id: str, data: dict):
    obj = get_promotion_request(db, promo_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    if data.get("status") in ("APPROVED", "REJECTED"): obj.decided_at = _now()
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


# ── Timeline ──────────────────────────────────────────────────────

def list_timeline_events(db: Session, tenant_id: str, employee_id: str, page: int = 1, page_size: int = 50):
    q = db.query(EmployeeTimelineEvent).filter(EmployeeTimelineEvent.tenant_id == tenant_id, EmployeeTimelineEvent.employee_id == employee_id).order_by(EmployeeTimelineEvent.event_date.desc())
    return _paginate(q, page, page_size)

def create_timeline_event(db: Session, tenant_id: str, data: dict):
    obj = EmployeeTimelineEvent(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj


# ── Documents ─────────────────────────────────────────────────────

def list_employee_documents(db: Session, tenant_id: str, employee_id: str, category: Optional[str] = None, page: int = 1, page_size: int = 20):
    q = db.query(EmployeeDocument).filter(EmployeeDocument.tenant_id == tenant_id, EmployeeDocument.employee_id == employee_id)
    if category: q = q.filter(EmployeeDocument.category == category)
    q = q.order_by(EmployeeDocument.created_at.desc())
    return _paginate(q, page, page_size)

def get_employee_document(db: Session, doc_id: UUID, tenant_id: str):
    return db.query(EmployeeDocument).filter(EmployeeDocument.id == doc_id, EmployeeDocument.tenant_id == tenant_id).first()

def create_employee_document(db: Session, tenant_id: str, data: dict):
    obj = EmployeeDocument(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def update_employee_document(db: Session, doc_id: UUID, tenant_id: str, data: dict):
    obj = get_employee_document(db, doc_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj

def delete_employee_document(db: Session, doc_id: UUID, tenant_id: str) -> bool:
    obj = get_employee_document(db, doc_id, tenant_id)
    if not obj: return False
    db.delete(obj); db.commit(); return True


# ── Employee Profile ──────────────────────────────────────────────

def get_employee_profile(db: Session, employee_id: str, tenant_id: str):
    return db.query(EmployeeProfile).filter(EmployeeProfile.employee_id == employee_id, EmployeeProfile.tenant_id == tenant_id).first()

def upsert_employee_profile(db: Session, tenant_id: str, employee_id: str, data: dict):
    existing = get_employee_profile(db, employee_id, tenant_id)
    if existing:
        for k, v in data.items():
            if v is not None: setattr(existing, k, v)
        existing.updated_at = _now()
    else:
        existing = EmployeeProfile(tenant_id=tenant_id, employee_id=employee_id, **data)
        db.add(existing)
    comp = _calc_profile_completeness(existing)
    existing.profile_completeness = comp
    db.commit(); db.refresh(existing); return existing

def _calc_profile_completeness(profile: EmployeeProfile) -> int:
    fields = [profile.personal_info, profile.contact_info, profile.employment_info, profile.education,
              profile.certifications, profile.work_history, profile.emergency_contacts, profile.skills_summary, profile.preferences]
    filled = sum(1 for f in fields if f and (isinstance(f, dict) and f) or (isinstance(f, list) and f))
    return int((filled / len(fields)) * 100)


# ── Achievements ──────────────────────────────────────────────────

def list_employee_achievements(db: Session, tenant_id: str, employee_id: str, category: Optional[str] = None, page: int = 1, page_size: int = 20):
    q = db.query(EmployeeAchievement).filter(EmployeeAchievement.tenant_id == tenant_id, EmployeeAchievement.employee_id == employee_id)
    if category: q = q.filter(EmployeeAchievement.category == category)
    q = q.order_by(EmployeeAchievement.date_awarded.desc().nullslast(), EmployeeAchievement.created_at.desc())
    return _paginate(q, page, page_size)

def create_employee_achievement(db: Session, tenant_id: str, data: dict):
    obj = EmployeeAchievement(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def update_employee_achievement(db: Session, ach_id: UUID, tenant_id: str, data: dict):
    obj = db.query(EmployeeAchievement).filter(EmployeeAchievement.id == ach_id, EmployeeAchievement.tenant_id == tenant_id).first()
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    db.commit(); db.refresh(obj); return obj

def delete_employee_achievement(db: Session, ach_id: UUID, tenant_id: str) -> bool:
    obj = db.query(EmployeeAchievement).filter(EmployeeAchievement.id == ach_id, EmployeeAchievement.tenant_id == tenant_id).first()
    if not obj: return False
    db.delete(obj); db.commit(); return True


# ── Career Roadmap ────────────────────────────────────────────────

def list_career_roadmaps(db: Session, tenant_id: str, employee_id: Optional[str] = None, page: int = 1, page_size: int = 20):
    q = db.query(CareerRoadmap).filter(CareerRoadmap.tenant_id == tenant_id)
    if employee_id: q = q.filter(CareerRoadmap.employee_id == employee_id)
    q = q.order_by(CareerRoadmap.created_at.desc())
    return _paginate(q, page, page_size)

def get_career_roadmap(db: Session, roadmap_id: UUID, tenant_id: str):
    return db.query(CareerRoadmap).filter(CareerRoadmap.id == roadmap_id, CareerRoadmap.tenant_id == tenant_id).first()

def create_career_roadmap(db: Session, tenant_id: str, data: dict):
    obj = CareerRoadmap(tenant_id=tenant_id, **data)
    db.add(obj); db.commit(); db.refresh(obj); return obj

def update_career_roadmap(db: Session, roadmap_id: UUID, tenant_id: str, data: dict):
    obj = get_career_roadmap(db, roadmap_id, tenant_id)
    if not obj: return None
    for k, v in data.items():
        if v is not None: setattr(obj, k, v)
    obj.updated_at = _now(); db.commit(); db.refresh(obj); return obj


# ── Dashboard ─────────────────────────────────────────────────────

def get_dashboard_stats(db: Session, tenant_id: str) -> dict:
    from sqlalchemy import func
    onboarding_pending = db.query(func.count(OnboardingAssignment.id)).filter(OnboardingAssignment.tenant_id == tenant_id, OnboardingAssignment.status == "PENDING").scalar() or 0
    onboarding_active = db.query(func.count(OnboardingAssignment.id)).filter(OnboardingAssignment.tenant_id == tenant_id, OnboardingAssignment.status == "IN_PROGRESS").scalar() or 0
    offboarding_pending = db.query(func.count(OffboardingRecord.id)).filter(OffboardingRecord.tenant_id == tenant_id, OffboardingRecord.status == "PENDING").scalar() or 0
    probations_active = db.query(func.count(ProbationRecord.id)).filter(ProbationRecord.tenant_id == tenant_id, ProbationRecord.status == "ACTIVE").scalar() or 0
    promotions_pending = db.query(func.count(PromotionRequest.id)).filter(PromotionRequest.tenant_id == tenant_id, PromotionRequest.status == "SUBMITTED").scalar() or 0
    transfers_pending = db.query(func.count(TransferRequest.id)).filter(TransferRequest.tenant_id == tenant_id, TransferRequest.status == "PENDING").scalar() or 0
    total_documents = db.query(func.count(EmployeeDocument.id)).filter(EmployeeDocument.tenant_id == tenant_id).scalar() or 0
    total_achievements = db.query(func.count(EmployeeAchievement.id)).filter(EmployeeAchievement.tenant_id == tenant_id).scalar() or 0
    total_career_roadmaps = db.query(func.count(CareerRoadmap.id)).filter(CareerRoadmap.tenant_id == tenant_id).scalar() or 0
    return {
        "onboarding_pending": onboarding_pending, "onboarding_active": onboarding_active,
        "offboarding_pending": offboarding_pending, "probations_active": probations_active,
        "promotions_pending": promotions_pending, "transfers_pending": transfers_pending,
        "total_documents": total_documents, "total_achievements": total_achievements,
        "total_career_roadmaps": total_career_roadmaps,
    }
