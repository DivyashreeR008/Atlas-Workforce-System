"""Candidate-authenticated portal surface (issue #502).

External candidates get a magic link (the same passwordless pattern
auth-service uses for employees, but scoped to a single ATS candidate) so
they can watch their application status timeline, upload supporting
documents, and confirm (or cancel) an interview from recruiter-published
slots.

Every read and write is scoped server side to the session token's tenant
and candidate: the scoped lookup returns 404 for anything that does not
belong to the caller, so candidate A can never fetch candidate B's timeline,
documents, or slots.
"""
import hashlib
import os
import secrets
import uuid as uuid_lib
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from sqlalchemy.orm import Session

from main import get_db, logger
from models import (
    Candidate as CandidateModel,
    Application as ApplicationModel,
    Interview as InterviewModel,
    CandidatePortalToken as CandidatePortalTokenModel,
    CandidateDocument as CandidateDocumentModel,
    InterviewSlot as InterviewSlotModel,
)
from file_security import validate_file, get_secure_path
import crud
import schemas

router = APIRouter(tags=["candidate-portal"])

LINK_TTL_MINUTES = 15
SESSION_TTL_MINUTES = 60 * 24
MAX_DOCUMENTS_PER_APPLICATION = 20


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_bearer(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing candidate session token")
    return authorization[len("Bearer "):].strip()


def _current_candidate(db: Session, authorization: Optional[str]) -> tuple:
    """Resolve the session token to (token_row, candidate). Any invalid,
    expired, or foreign-tenant token is a plain 401."""
    raw = _parse_bearer(authorization)
    now = _utcnow()
    row = (
        db.query(CandidatePortalTokenModel)
        .filter(
            CandidatePortalTokenModel.token_hash == _hash_token(raw),
            CandidatePortalTokenModel.kind == "SESSION",
            CandidatePortalTokenModel.used_at == None,  # noqa: E711
            CandidatePortalTokenModel.expires_at > now,
        )
        .with_for_update()
        .first()
    )
    if not row:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    candidate = (
        db.query(CandidateModel)
        .filter(
            CandidateModel.id == row.candidate_id,
            CandidateModel.tenant_id == row.tenant_id,
        )
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return row, candidate


def _get_scoped_application(db: Session, application_id: str, token_row) -> object:
    """Fetch an application only if it belongs to the caller's tenant and
    candidate. Non-matching ids are indistinguishable (404)."""
    return (
        db.query(ApplicationModel)
        .filter(
            ApplicationModel.id == application_id,
            ApplicationModel.tenant_id == token_row.tenant_id,
            ApplicationModel.candidate_id == token_row.candidate_id,
        )
        .first()
    )


# --- Auth (public, tenant comes from the candidate record) ---

@router.post("/candidate-portal/auth/request", status_code=202,
             summary="Public: Request a candidate magic link")
def request_magic_link(
    data: schemas.CandidatePortalAuthRequest,
    db: Session = Depends(get_db),
):
    candidate = (
        db.query(CandidateModel)
        .filter(
            CandidateModel.email == data.email,
            CandidateModel.tenant_id == data.tenant_id,
        )
        .first()
    )
    # Anti-enumeration: unknown/failed requests return the same generic body
    # and persist nothing.
    if candidate is None:
        return {"detail": "If a candidate record exists for this email, a magic link has been sent."}

    now = _utcnow()
    # Housekeeping: drop exhausted or expired link tokens for this candidate.
    db.query(CandidatePortalTokenModel).filter(
        CandidatePortalTokenModel.candidate_id == candidate.id,
        CandidatePortalTokenModel.kind == "LINK",
        CandidatePortalTokenModel.used_at != None,  # noqa: E711
    ).delete(synchronize_session=False)
    db.query(CandidatePortalTokenModel).filter(
        CandidatePortalTokenModel.candidate_id == candidate.id,
        CandidatePortalTokenModel.kind == "LINK",
        CandidatePortalTokenModel.expires_at <= now,
    ).delete(synchronize_session=False)

    raw_token = secrets.token_urlsafe(32)
    link = CandidatePortalTokenModel(
        id=uuid_lib.uuid4(),
        tenant_id=candidate.tenant_id,
        candidate_id=candidate.id,
        kind="LINK",
        token_hash=_hash_token(raw_token),
        expires_at=now + timedelta(minutes=LINK_TTL_MINUTES),
    )
    db.add(link)
    db.commit()

    # No mailer is wired into ats-service yet; delivery (written to the
    # candidate's email via the notification service) is a follow-up. The
    # raw token never appears in logs or responses.
    logger.info(
        "portal.magic_link_requested",
        extra={"candidate_id": str(candidate.id), "tenant_id": candidate.tenant_id},
    )
    return {"detail": "If a candidate record exists for this email, a magic link has been sent."}


@router.post("/candidate-portal/auth/verify", response_model=schemas.CandidatePortalSessionResponse,
             summary="Public: Verify a magic link and start a session")
def verify_magic_link(
    data: schemas.CandidatePortalVerifyRequest,
    db: Session = Depends(get_db),
):
    now = _utcnow()
    link = (
        db.query(CandidatePortalTokenModel)
        .filter(
            CandidatePortalTokenModel.token_hash == _hash_token(data.token),
            CandidatePortalTokenModel.kind == "LINK",
            CandidatePortalTokenModel.used_at == None,  # noqa: E711
            CandidatePortalTokenModel.expires_at > now,
        )
        .with_for_update()
        .first()
    )
    if not link:
        raise HTTPException(status_code=401, detail="Invalid or expired magic link")

    # Consume the link atomically under row lock and mint a session token.
    candidate = (
        db.query(CandidateModel)
        .filter(
            CandidateModel.id == link.candidate_id,
            CandidateModel.tenant_id == link.tenant_id,
        )
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=401, detail="Invalid or expired magic link")

    link.used_at = now
    session_raw = secrets.token_urlsafe(32)
    session = CandidatePortalTokenModel(
        id=uuid_lib.uuid4(),
        tenant_id=candidate.tenant_id,
        candidate_id=candidate.id,
        kind="SESSION",
        token_hash=_hash_token(session_raw),
        expires_at=now + timedelta(minutes=SESSION_TTL_MINUTES),
    )
    db.add(session)
    db.commit()

    return {
        "access_token": session_raw,
        "token_type": "bearer",
        "expires_in": SESSION_TTL_MINUTES * 60,
    }


# --- Recruiter-only: hand out a magic link for one of their applications ---

@router.post("/candidate-portal/auth/invite", response_model=schemas.CandidatePortalInviteResponse,
             status_code=201, summary="Recruiter: Send a candidate portal magic link")
def invite_candidate(
    data: schemas.CandidatePortalInviteRequest,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    application = (
        db.query(ApplicationModel)
        .filter(
            ApplicationModel.id == data.application_id,
            ApplicationModel.tenant_id == x_tenant_id,
        )
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    candidate = (
        db.query(CandidateModel)
        .filter(CandidateModel.id == application.candidate_id).first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Application not found")

    now = _utcnow()
    raw_token = secrets.token_urlsafe(32)
    link = CandidatePortalTokenModel(
        tenant_id=x_tenant_id,
        candidate_id=candidate.id,
        kind="LINK",
        token_hash=_hash_token(raw_token),
        expires_at=now + timedelta(minutes=LINK_TTL_MINUTES),
    )
    db.add(link)
    db.commit()
    return {
        "application_id": data.application_id,
        "magic_link": f"/candidate-portal/auth/verify?token={raw_token}",
        "expires_in_minutes": LINK_TTL_MINUTES,
    }


# --- Candidate: own profile and applications ---

@router.get("/candidate-portal/me", response_model=schemas.CandidatePortalMeResponse,
            summary="Candidate: My profile and applications")
def get_me(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    token_row, candidate = _current_candidate(db, authorization)
    applications = (
        db.query(ApplicationModel)
        .filter(
            ApplicationModel.candidate_id == token_row.candidate_id,
            ApplicationModel.tenant_id == token_row.tenant_id,
        )
        .all()
    )
    items = []
    for app in applications:
        summary = schemas.CandidatePortalApplicationSummary(
            id=str(app.id),
            job_id=str(app.job_id),
            job_title=app.job.title if getattr(app, "job", None) is not None else None,
            status=app.status,
            application_date=app.application_date,
        )
        items.append(summary)
    return schemas.CandidatePortalMeResponse(
        candidate_id=str(candidate.id),
        email=candidate.email,
        first_name=candidate.first_name,
        last_name=candidate.last_name,
        applications=items,
    )


@router.get("/candidate-portal/applications/{application_id}/timeline",
            response_model=list[schemas.ApplicationTimelineEvent],
            summary="Candidate: My application status timeline")
def get_timeline(
    application_id: str,
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    token_row, _candidate = _current_candidate(db, authorization)
    app = _get_scoped_application(db, application_id, token_row)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    timeline = crud.get_application_timeline(db, application_id, token_row.tenant_id)
    if timeline is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return timeline


# --- Candidate: documents ---

@router.get("/candidate-portal/applications/{application_id}/documents",
            response_model=list[schemas.CandidatePortalDocumentResponse],
            summary="Candidate: My application documents")
def list_documents(
    application_id: str,
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    token_row, _candidate = _current_candidate(db, authorization)
    app = _get_scoped_application(db, application_id, token_row)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    docs = (
        db.query(CandidateDocumentModel)
        .filter(
            CandidateDocumentModel.application_id == application_id,
            CandidateDocumentModel.tenant_id == token_row.tenant_id,
            CandidateDocumentModel.candidate_id == token_row.candidate_id,
        )
        .all()
    )
    return [crud.serialize_uuid(d) for d in docs]


@router.post("/candidate-portal/applications/{application_id}/documents",
             response_model=schemas.CandidatePortalDocumentResponse, status_code=201,
             summary="Candidate: Upload a document to my application")
def upload_document(
    application_id: str,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    token_row, _candidate = _current_candidate(db, authorization)
    app = _get_scoped_application(db, application_id, token_row)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    uploaded = (
        db.query(CandidateDocumentModel)
        .filter(
            CandidateDocumentModel.application_id == application_id,
            CandidateDocumentModel.tenant_id == token_row.tenant_id,
            CandidateDocumentModel.candidate_id == token_row.candidate_id,
        )
        .all()
    )
    if len(uploaded) >= MAX_DOCUMENTS_PER_APPLICATION:
        raise HTTPException(status_code=400, detail="Too many documents for this application")

    contents = file.file.read()
    ok, err = validate_file(file.filename or "", contents)
    if not ok:
        raise HTTPException(status_code=400, detail=err)

    secure_path = get_secure_path(file.filename)
    secure_dir = os.path.dirname(secure_path)
    if secure_dir:
        os.makedirs(secure_dir, exist_ok=True)
    with open(secure_path, "wb") as out:
        out.write(contents)

    doc = CandidateDocumentModel(
        id=uuid_lib.uuid4(),
        tenant_id=token_row.tenant_id,
        application_id=app.id,
        candidate_id=token_row.candidate_id,
        filename=file.filename,
        file_url=secure_path,
        file_size=len(contents),
        content_type=file.content_type,
    )
    db.add(doc)
    db.commit()
    return crud.serialize_uuid(doc)


# --- Candidate: interview slots ---

@router.get("/candidate-portal/applications/{application_id}/slots",
            response_model=list[schemas.InterviewSlotResponse],
            summary="Candidate: Interview slots published for my application")
def list_slots(
    application_id: str,
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    token_row, _candidate = _current_candidate(db, authorization)
    app = _get_scoped_application(db, application_id, token_row)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    slots = (
        db.query(InterviewSlotModel)
        .filter(
            InterviewSlotModel.application_id == application_id,
            InterviewSlotModel.tenant_id == token_row.tenant_id,
        )
        .all()
    )
    return [crud.serialize_uuid(s) for s in slots]


@router.post("/candidate-portal/applications/{application_id}/slots/{slot_id}/confirm",
             response_model=schemas.InterviewSlotResponse, status_code=200,
             summary="Candidate: Confirm my interview slot")
def confirm_slot(
    application_id: str,
    slot_id: str,
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    token_row, _candidate = _current_candidate(db, authorization)
    app = _get_scoped_application(db, application_id, token_row)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    now = _utcnow()
    slot = (
        db.query(InterviewSlotModel)
        .filter(
            InterviewSlotModel.id == slot_id,
            InterviewSlotModel.tenant_id == token_row.tenant_id,
            InterviewSlotModel.application_id == app.id,
        )
        .first()
    )
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.status != "OPEN":
        raise HTTPException(status_code=409, detail="Slot is no longer available")
    if slot.scheduled_at and slot.scheduled_at <= now:
        raise HTTPException(status_code=409, detail="Slot time has already passed")

    # Materialise a real Interview so the recruiter pipeline and the
    # application timeline both see the booking.
    interview = InterviewModel(
        id=uuid_lib.uuid4(),
        tenant_id=token_row.tenant_id,
        application_id=app.id,
        interview_type=slot.interview_type,
        interviewer_id=slot.interviewer_id,
        scheduled_at=slot.scheduled_at,
        duration_minutes=slot.duration_minutes,
        location=slot.location,
        meeting_link=slot.meeting_link,
        status="SCHEDULED",
    )
    db.add(interview)
    db.flush()
    slot.status = "CONFIRMED"
    slot.interview_id = interview.id
    slot.updated_at = now
    db.commit()
    return crud.serialize_uuid(slot)


@router.post("/candidate-portal/applications/{application_id}/slots/{slot_id}/cancel",
             response_model=schemas.InterviewSlotResponse, status_code=200,
             summary="Candidate: Cancel my confirmed interview slot")
def cancel_slot(
    application_id: str,
    slot_id: str,
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    token_row, _candidate = _current_candidate(db, authorization)
    app = _get_scoped_application(db, application_id, token_row)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    slot = (
        db.query(InterviewSlotModel)
        .filter(
            InterviewSlotModel.id == slot_id,
            InterviewSlotModel.tenant_id == token_row.tenant_id,
            InterviewSlotModel.application_id == app.id,
        )
        .first()
    )
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.status != "CONFIRMED":
        raise HTTPException(status_code=409, detail="Slot is not confirmed")

    if slot.interview_id:
        interview = (
            db.query(InterviewModel)
            .filter(InterviewModel.id == slot.interview_id).first()
        )
        if interview:
            interview.status = "CANCELLED"
            interview.updated_at = _utcnow()

    slot.status = "OPEN"
    slot.interview_id = None
    slot.updated_at = _utcnow()
    db.commit()
    return crud.serialize_uuid(slot)
