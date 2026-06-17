from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from main import get_db, logger
import crud
import schemas

router = APIRouter(tags=["interviews"])


@router.get("/interviews", response_model=schemas.PaginatedResponse[schemas.InterviewResponse], summary="List interviews")
def list_interviews(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    interviewer_id: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    return crud.list_interviews(db, x_tenant_id, page, page_size, interviewer_id, date_from, date_to)


@router.post("/interviews", response_model=schemas.InterviewResponse, status_code=201, summary="Schedule interview")
def create_interview(
    data: schemas.InterviewCreate,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    if data.interviewer_id and crud.check_interview_overlap(db, data.interviewer_id, data.scheduled_at, data.duration_minutes):
        logger.warning("interview.overlap_rejected", extra={"interviewer_id": data.interviewer_id, "scheduled_at": data.scheduled_at.isoformat() if data.scheduled_at else None})
        raise HTTPException(status_code=409, detail="Interviewer already has an interview scheduled at this time")
    interview = crud.create_interview(db, x_tenant_id, data)
    if not interview:
        raise HTTPException(status_code=400, detail="Application not found")
    return interview


@router.put("/interviews/{interview_id}", response_model=schemas.InterviewResponse, summary="Update interview")
def update_interview(
    interview_id: str,
    data: schemas.InterviewUpdate,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    interview = crud.update_interview(db, interview_id, x_tenant_id, data)
    if interview is None:
        raise HTTPException(status_code=404, detail="Interview not found or time slot conflict")
    return interview


@router.put("/interviews/{interview_id}/feedback",
            response_model=schemas.InterviewResponse,
            summary="Submit interview feedback")
def submit_interview_feedback(
    interview_id: str,
    data: schemas.InterviewFeedback,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    interview = crud.submit_interview_feedback(db, interview_id, x_tenant_id, data)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


@router.put("/interviews/{interview_id}/status",
            response_model=schemas.InterviewResponse,
            summary="Update interview status")
def update_interview_status(
    interview_id: str,
    data: schemas.InterviewStatusUpdate,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    interview = crud.update_interview_status(db, interview_id, x_tenant_id, data.status)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview
