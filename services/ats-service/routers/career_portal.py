from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from main import get_db
from models import Job as JobModel, Candidate as CandidateModel, Application as ApplicationModel
import crud
import schemas

router = APIRouter(tags=["career-portal"])


@router.get("/career/jobs", summary="Public: List published jobs")
def public_list_jobs(
    department: Optional[str] = Query(None),
    employment_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(JobModel).filter(JobModel.status == "PUBLISHED")
    if department:
        q = q.filter(JobModel.department == department)
    if employment_type:
        q = q.filter(JobModel.employment_type == employment_type)
    if search:
        pattern = f"%{search}%"
        q = q.filter(or_(
            JobModel.title.ilike(pattern),
            JobModel.department.ilike(pattern),
            JobModel.description.ilike(pattern),
        ))
    q = q.order_by(JobModel.posted_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    result = []
    for job in items:
        j = crud.serialize_uuid(job)
        j.pop("tenant_id", None)
        result.append(j)
    return crud.paginated_response(result, total, page, page_size)


@router.get("/career/jobs/{job_id}", summary="Public: Get job details")
def public_get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(JobModel).filter(
        JobModel.id == job_id,
        JobModel.status == "PUBLISHED",
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    j = crud.serialize_uuid(job)
    j.pop("tenant_id", None)
    return j


@router.post("/career/apply", response_model=schemas.CandidateResponse,
             status_code=201, summary="Public: Apply to a job")
def public_apply(
    job_id: str = Query(...),
    first_name: str = Query(...),
    last_name: str = Query(...),
    email: str = Query(...),
    phone: Optional[str] = Query(None),
    resume_url: Optional[str] = Query(None),
    cover_letter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
):
    job = db.query(JobModel).filter(
        JobModel.id == job_id,
        JobModel.status == "PUBLISHED",
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not published")

    existing_candidate = db.query(CandidateModel).filter(
        CandidateModel.email == email,
        CandidateModel.tenant_id == x_tenant_id,
    ).first()

    if existing_candidate:
        candidate_id = existing_candidate.id
    else:
        cand_data = schemas.CandidateCreate(
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            resume_url=resume_url,
            source="COMPANY_SITE",
        )
        candidate = crud.create_candidate(db, x_tenant_id, cand_data)
        candidate_id = candidate["id"]

    existing_app = db.query(ApplicationModel).filter(
        ApplicationModel.job_id == job_id,
        ApplicationModel.candidate_id == candidate_id,
    ).first()
    if existing_app:
        raise HTTPException(status_code=400, detail="You have already applied to this job")

    app_data = schemas.ApplicationCreate(
        job_id=job_id,
        candidate_id=str(candidate_id),
        cover_letter=cover_letter,
    )
    app = crud.create_application(db, x_tenant_id, app_data)
    if not app:
        raise HTTPException(status_code=400, detail="Failed to submit application")

    return crud.get_candidate(db, str(candidate_id), x_tenant_id)
