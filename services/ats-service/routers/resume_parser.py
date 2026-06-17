from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["resume-parser"])


@router.post("/resumes/parse", response_model=schemas.ResumeParseResponse, summary="Parse resume text")
def parse_resume(raw_text: str = Query(...)):
    result = crud.parse_resume_text(raw_text)
    return result


@router.post("/resumes", response_model=schemas.ResumeUploadResponse,
             status_code=201, summary="Upload and store resume")
def upload_resume(
    data: schemas.ResumeCreate,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    if data.raw_text:
        raw_bytes = data.raw_text.encode('utf-8')
        if len(raw_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="Resume content exceeds maximum allowed size")
    parsed = crud.parse_resume_text(data.raw_text)
    enriched = data.model_dump()
    enriched["parsed_skills"] = enriched.get("parsed_skills") or parsed["skills"]
    enriched["parsed_experience_years"] = enriched.get("parsed_experience_years") or parsed["experience_years"]
    enriched["parsed_education"] = enriched.get("parsed_education") or parsed["education"]
    enriched["parsed_certifications"] = enriched.get("parsed_certifications") or parsed["certifications"]
    enriched["parsed_languages"] = enriched.get("parsed_languages") or parsed["languages"]
    enriched["parsed_summary"] = enriched.get("parsed_summary") or parsed["summary"]

    if enriched.get("candidate_id"):
        candidate = db.query(crud.models.Candidate).filter(
            crud.models.Candidate.id == enriched["candidate_id"]
        ).first()
        if candidate:
            update_skills = list(set((candidate.skills or []) + parsed["skills"]))
            candidate.skills = update_skills
            if not candidate.resume_url:
                candidate.resume_url = enriched.get("filename")
            db.commit()

    resume = crud.create_resume(db, x_tenant_id, schemas.ResumeCreate(**enriched))
    return resume


@router.get("/resumes", response_model=schemas.PaginatedResponse[schemas.ResumeUploadResponse], summary="List resumes")
def list_resumes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    candidate_id: Optional[str] = Query(None),
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    return crud.list_resumes(db, x_tenant_id, page, page_size, candidate_id)


@router.get("/resumes/{resume_id}", response_model=schemas.ResumeUploadResponse, summary="Get resume")
def get_resume(
    resume_id: str,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    resume = crud.get_resume(db, resume_id, x_tenant_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume


@router.post("/ai/rank", response_model=schemas.RankCandidatesResponse, summary="AI rank candidates for a job")
def rank_candidates(
    data: schemas.CandidateMatchRequest,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    result = crud.rank_candidates_for_job(db, x_tenant_id, data.job_id, data.candidate_ids)
    if not result:
        raise HTTPException(status_code=404, detail="Job not found")
    return result


@router.post("/ai/score", response_model=schemas.CandidateScoreResponse, summary="Score a candidate for a job")
def score_candidate(
    data: schemas.CandidateScoreRequest,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    result = crud.score_candidate_for_job(db, x_tenant_id, data.candidate_id, data.job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Candidate or job not found")
    return result


@router.get("/ai/rankings/job/{job_id}", summary="Get rankings for a job")
def get_job_rankings(
    job_id: str,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    rankings = (
        db.query(crud.models.ResumeRanking)
        .filter(
            crud.models.ResumeRanking.job_id == job_id,
            crud.models.ResumeRanking.tenant_id == x_tenant_id,
        )
        .order_by(crud.models.ResumeRanking.rank.asc())
        .all()
    )
    result = []
    for r in rankings:
        c = db.query(crud.models.Candidate).filter(crud.models.Candidate.id == r.candidate_id).first()
        result.append({
            "candidate_id": str(r.candidate_id),
            "candidate_name": f"{c.first_name} {c.last_name}" if c else "Unknown",
            "match_score": float(r.match_score),
            "skills_match": float(r.skills_match),
            "experience_match": float(r.experience_match),
            "education_match": float(r.education_match),
            "rank": r.rank,
            "ai_notes": r.ai_notes,
        })
    return {"job_id": job_id, "rankings": result}
