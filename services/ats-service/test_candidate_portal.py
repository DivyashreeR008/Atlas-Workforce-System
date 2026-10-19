"""Tests for the candidate portal surface (issue #502).

Covers the magic-link handshake (invite -> verify -> session), the tenant
and candidate scoping guarantees (candidate A must not be able to read
candidate B's timeline, documents, or slots), document upload validation
(wrong type, oversize), and the slot publish -> confirm -> cancel flow
with the resulting interview visible.

These tests route the app's get_db dependency through an in-memory fake
that actually evaluates the SQLAlchemy filter expressions the routers
build, so scoping behaviour is exercised, not stubbed away.
"""
import base64
import hashlib
import hmac
import json
import operator
import os
import tempfile
import time
import uuid
from datetime import datetime, timedelta, timezone

# Uploads land in a temp dir; the env var must be set before file_security
# (imported by main) reads it.
os.environ["FILE_UPLOAD_DIR"] = os.path.join(tempfile.gettempdir(), "ats-portal-test-uploads")
os.environ.setdefault("INTERNAL_JWT_SECRET", "test-secret")
INTERNAL_JWT_SECRET = "test-secret"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.sql.operators import or_ as sql_or

from main import app, get_db
from models import (
    Application as ApplicationModel,
    Candidate as CandidateModel,
    Interview as InterviewModel,
    InterviewSlot as InterviewSlotModel,
    CandidatePortalToken as CandidatePortalTokenModel,
    CandidateDocument as CandidateDocumentModel,
)
import file_security


def _make_internal_token(secret: str) -> str:
    hdr = base64.urlsafe_b64encode(
        json.dumps({"alg": "HS256", "typ": "JWT"}).encode()
    ).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(
        json.dumps(
            {
                "sub": "recruiter",
                "tenant_id": "acme",
                "exp": int(time.time()) + 3600,
            }
        ).encode()
    ).rstrip(b"=").decode()
    sig = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), f"{hdr}.{payload}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"{hdr}.{payload}.{sig}"


INNER_AUTH = {"x-internal-auth": _make_internal_token(INTERNAL_JWT_SECRET)}


def _eval_expr(expr, row):
    """Evaluate the SQLAlchemy comparisons the portal routers build
    (Column == value, IS NULL, IS NOT NULL, <, <=, > and or_/and_ groups)."""
    if hasattr(expr, "clauses"):  # or_/and_ BooleanClauseList
        results = [_eval_expr(c, row) for c in expr.clauses]
        return any(results) if expr.operator is sql_or else all(results)
    if not hasattr(expr, "operator") or not hasattr(expr, "left"):
        raise AssertionError(f"Unsupported expression in fake query: {expr!r}")
    value = getattr(row, expr.left.name)
    raw_rhs = expr.right
    rhs = getattr(raw_rhs, "value", raw_rhs)
    # Transient model instances keep UUID columns as uuid.UUID; normalise for
    # comparison against the string form sqlalchemy/HTTP layers use.
    if isinstance(value, uuid.UUID):
        value = str(value)
    if isinstance(rhs, uuid.UUID):
        rhs = str(rhs)
    if raw_rhs is None or type(raw_rhs).__name__ == "Null":
        # `col == None` / `!= None` compile to IS NULL / IS NOT NULL
        name = getattr(expr.operator, "__name__", "")
        if name in ("eq", "is_") or name.startswith("is_"):
            return value is None
        return value is not None
    if value is None and getattr(expr.operator, "__name__", "").startswith("is"):
        # Column-side None compiles to IS NULL semantics.
        return True
    return expr.operator(value, rhs)


class _FakeQuery:
    def __init__(self, model, rows, owner=None):
        self._model = model
        self._rows = rows
        self._owner = owner

    def filter(self, *exprs):
        print("FILTER", self._model.__name__, "n_rows", len(self._rows), [type(x).__name__ for x in exprs], flush=True)
        kept = []
        for row in self._rows:
            if all(_eval_expr(e, row) for e in exprs):
                kept.append(row)
        return _FakeQuery(self._model, kept, self._owner)

    def join(self, *a, **k):
        return self

    def order_by(self, *a, **k):
        return self

    def offset(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def with_for_update(self):
        return self

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return list(self._rows)

    def count(self):
        return len(self._rows)

    def delete(self, synchronize_session=False):
        removed = len(self._rows)
        if self._owner is not None:
            for row in self._rows:
                self._owner.remove(row)
        return removed


class _FakeDB:
    def __init__(self):
        self.tables = {}
        self.added = []

    def query(self, model):
        tbl = self.tables.setdefault(model, [])
        return _FakeQuery(model, tbl, tbl)

    def add(self, obj):
        self.added.append(obj)
        self.tables.setdefault(type(obj), []).append(obj)

    def commit(self):
        pass

    def flush(self):
        pass

    def refresh(self, obj):
        pass

    def close(self):
        pass


def _make_candidate(tenant_id="acme", email="ada@example.com"):
    return CandidateModel(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        first_name="Ada",
        last_name="Lovelace",
        email=email,
        status="NEW",
    )


def _make_application(candidate, tenant_id="acme", job_id=None):
    return ApplicationModel(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        job_id=job_id or uuid.uuid4(),
        candidate_id=candidate.id,
        status="SCREENING",
        created_at=datetime.now(timezone.utc) - timedelta(days=3),
        updated_at=datetime.now(timezone.utc) - timedelta(days=3),
        interviews=[],
        offers=[],
    )


def _client_with_db(fake_db, auth=True):
    headers = dict(INNER_AUTH) if auth else {}
    app.dependency_overrides[get_db] = lambda: fake_db
    return TestClient(app, headers=headers)


@pytest.fixture(autouse=True)
def _clean_overrides():
    yield
    app.dependency_overrides.clear()


def _seed_auth(fake_db, tenant_id="acme"):
    """Create a candidate + application and run the invite -> verify steps.
    Returns (client, bearer, application, candidate)."""
    candidate = _make_candidate(tenant_id=tenant_id)
    application = _make_application(candidate, tenant_id=tenant_id)
    fake_db.tables.setdefault(CandidateModel, []).append(candidate)
    fake_db.tables.setdefault(ApplicationModel, []).append(application)
    client = _client_with_db(fake_db)

    invite = client.post(
        "/api/v1/candidate-portal/auth/invite",
        json={"application_id": str(application.id)},
        headers={"X-Tenant-Id": tenant_id},
    )
    assert invite.status_code == 201, invite.text
    raw_token = invite.json()["magic_link"].split("token=")[1]

    verify = client.post(
        "/api/v1/candidate-portal/auth/verify",
        json={"token": raw_token},
    )
    assert verify.status_code == 200, verify.text
    bearer = {"Authorization": f"Bearer {verify.json()['access_token']}"}
    return client, bearer, application, candidate


def test_portal_invite_requires_internal_auth():
    fake_db = _FakeDB()
    client = _client_with_db(fake_db, auth=False)
    response = client.post(
        "/api/v1/candidate-portal/auth/invite",
        json={"application_id": str(uuid.uuid4())},
    )
    assert response.status_code == 401
    assert fake_db.added == []


def test_magic_link_request_does_not_leak_unknown_emails():
    fake_db = _FakeDB()
    client = _client_with_db(fake_db)
    response = client.post(
        "/api/v1/candidate-portal/auth/request",
        json={"email": "ghost@example.com", "tenant_id": "acme"},
    )
    assert response.status_code == 202
    assert response.json() == {
        "detail": "If a candidate record exists for this email, a magic link has been sent."
    }
    assert fake_db.added == []


def test_magic_link_requests_are_candidate_scoped():
    fake_db = _FakeDB()
    candidate = _make_candidate(email="ada@example.com")
    fake_db.tables.setdefault(CandidateModel, []).append(candidate)
    client = _client_with_db(fake_db)

    client.post(
        "/api/v1/candidate-portal/auth/request",
        json={"email": "other@example.com", "tenant_id": "acme"},
    )
    tokens = [t for t in fake_db.added if isinstance(t, CandidatePortalTokenModel)]
    assert tokens == []

    client.post(
        "/api/v1/candidate-portal/auth/request",
        json={"email": "ada@example.com", "tenant_id": "acme"},
    )
    tokens = [t for t in fake_db.added if isinstance(t, CandidatePortalTokenModel)]
    assert len(tokens) == 1
    assert tokens[0].tenant_id == "acme"
    assert tokens[0].kind == "LINK"
    assert tokens[0].used_at is None


def test_timeline_scoped_to_own_application():
    fake_db = _FakeDB()
    client, bearer, application, _candidate = _seed_auth(fake_db)

    response = client.get(
        f"/api/v1/candidate-portal/applications/{application.id}/timeline",
        headers=bearer,
    )
    assert response.status_code == 200
    events = response.json()
    assert any("SCREENING" in e["event"] for e in events)

    # Candidate B (different application) is a 404, not a leak.
    other_candidate = _make_candidate(tenant_id="acme", email="bob@example.com")
    other_application = _make_application(other_candidate)
    fake_db.tables.setdefault(CandidateModel, []).append(other_candidate)
    fake_db.tables.setdefault(ApplicationModel, []).append(other_application)

    response = client.get(
        f"/api/v1/candidate-portal/applications/{other_application.id}/timeline",
        headers=bearer,
    )
    assert response.status_code == 404


def test_documents_scoped_and_validated(monkeypatch):
    fake_db = _FakeDB()
    client, bearer, application, _candidate = _seed_auth(fake_db)
    base = f"/api/v1/candidate-portal/applications/{application.id}/documents"

    listed = client.get(base, headers=bearer)
    assert listed.status_code == 200
    assert listed.json() == []

    # Wrong type (executable magic bytes) is rejected.
    blocked = client.post(
        base,
        files={"file": ("resume.pdf", b"MZ virus", "application/pdf")},
        headers=bearer,
    )
    assert blocked.status_code == 400

    # Oversize is rejected.
    monkeypatch.setattr(file_security, "MAX_FILE_SIZE", 10)
    oversize = client.post(
        base,
        files={"file": ("resume.txt", b"x" * 100, "text/plain")},
        headers=bearer,
    )
    assert oversize.status_code == 400
    monkeypatch.setattr(file_security, "MAX_FILE_SIZE", 10 * 1024 * 1024)

    ok = client.post(
        base,
        files={"file": ("resume.pdf", b"%PDF-1.4 test", "application/pdf")},
        headers=bearer,
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["filename"] == "resume.pdf"

    docs = [t for t in fake_db.added if isinstance(t, CandidateDocumentModel)]
    assert len(docs) == 1
    assert docs[0].tenant_id == "acme"
    assert docs[0].filename == "resume.pdf"


def test_documents_cannot_read_foreign_application():
    fake_db = _FakeDB()
    client, bearer, _application, _candidate = _seed_auth(fake_db)
    other_candidate = _make_candidate(tenant_id="acme", email="bob@example.com")
    other_application = _make_application(other_candidate)
    fake_db.tables.setdefault(CandidateModel, []).append(other_candidate)
    fake_db.tables.setdefault(ApplicationModel, []).append(other_application)

    response = client.get(
        f"/api/v1/candidate-portal/applications/{other_application.id}/documents",
        headers=bearer,
    )
    assert response.status_code == 404


def test_bad_or_missing_session_token_is_401():
    fake_db = _FakeDB()
    candidate = _make_candidate()
    application = _make_application(candidate)
    fake_db.tables.setdefault(CandidateModel, []).append(candidate)
    fake_db.tables.setdefault(ApplicationModel, []).append(application)
    client = _client_with_db(fake_db)

    url = f"/api/v1/candidate-portal/applications/{application.id}/timeline"
    assert client.get(url).status_code == 401
    assert client.get(url, headers={"Authorization": "Bearer nonsense"}).status_code == 401


def test_replay_and_expired_link_tokens_cannot_verify():
    fake_db = _FakeDB()
    candidate = _make_candidate()
    application = _make_application(candidate)
    fake_db.tables.setdefault(CandidateModel, []).append(candidate)
    fake_db.tables.setdefault(ApplicationModel, []).append(application)
    client = _client_with_db(fake_db)

    invite = client.post(
        "/api/v1/candidate-portal/auth/invite",
        json={"application_id": str(application.id)},
        headers={"X-Tenant-Id": "acme"},
    )
    raw_token = invite.json()["magic_link"].split("token=")[1]

    # An unknown token hash is rejected.
    assert client.post(
        "/api/v1/candidate-portal/auth/verify", json={"token": "0" * 43}
    ).status_code == 401

    # Expired on the DB but readable by hash: expired links are dead.
    links = [t for t in fake_db.added
             if isinstance(t, CandidatePortalTokenModel) and t.kind == "LINK"]
    assert len(links) == 1
    links[0].expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    assert client.post(
        "/api/v1/candidate-portal/auth/verify", json={"token": raw_token}
    ).status_code == 401

    links[0].expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    first = client.post("/api/v1/candidate-portal/auth/verify", json={"token": raw_token})
    assert first.status_code == 200

    # Replay: the link is single-use.
    assert client.post(
        "/api/v1/candidate-portal/auth/verify", json={"token": raw_token}
    ).status_code == 401


def test_publish_confirm_cancel_flow():
    fake_db = _FakeDB()
    client, bearer, application, _candidate = _seed_auth(fake_db)
    base = f"/api/v1/candidate-portal/applications/{application.id}/slots"

    future = datetime.now(timezone.utc) + timedelta(days=2)
    published = client.post(
        "/api/v1/interview-slots",
        json={
            "application_id": str(application.id),
            "interview_type": "VIDEO",
            "interviewer_id": "int-1",
            "scheduled_at": future.isoformat(),
            "duration_minutes": 45,
        },
        headers={"X-Tenant-Id": "acme"},
    )
    assert published.status_code == 201, published.text
    slot_id = published.json()["id"]

    listed = client.get(base, headers=bearer)
    assert listed.status_code == 200
    assert [s["id"] for s in listed.json()] == [slot_id]

    past = client.post(
        "/api/v1/interview-slots",
        json={
            "application_id": str(application.id),
            "interview_type": "VIDEO",
            "scheduled_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
        },
        headers={"X-Tenant-Id": "acme"},
    )
    assert past.status_code == 400

    confirmed = client.post(f"{base}/{slot_id}/confirm", headers=bearer)
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "CONFIRMED"
    assert confirmed.json()["interview_id"] is not None
    interviews = [t for t in fake_db.added if isinstance(t, InterviewModel)]
    assert len(interviews) == 1
    assert interviews[0].status == "SCHEDULED"

    # Double booking is a conflict.
    again = client.post(f"{base}/{slot_id}/confirm", headers=bearer)
    assert again.status_code == 409

    # The timeline now shows the booking. (crud.get_application_timeline
    # re-reads the application's interviews like a fresh query would.)
    application.interviews = [t for t in fake_db.added if isinstance(t, InterviewModel)]
    timeline = client.get(
        f"/api/v1/candidate-portal/applications/{application.id}/timeline",
        headers=bearer,
    )
    assert timeline.status_code == 200
    assert any("Interview scheduled" in e["event"] for e in timeline.json())

    cancelled = client.post(f"{base}/{slot_id}/cancel", headers=bearer)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "OPEN"
    assert cancelled.json()["interview_id"] is None
    assert interviews[0].status == "CANCELLED"

    # Cancelling an open slot again is a conflict.
    recancel = client.post(f"{base}/{slot_id}/cancel", headers=bearer)
    assert recancel.status_code == 409


def test_slots_scoped_to_callers_application():
    fake_db = _FakeDB()
    client, bearer, _application, _candidate = _seed_auth(fake_db)
    other_candidate = _make_candidate(tenant_id="acme", email="bob@example.com")
    other_application = _make_application(other_candidate)
    fake_db.tables.setdefault(CandidateModel, []).append(other_candidate)
    fake_db.tables.setdefault(ApplicationModel, []).append(other_application)

    future = datetime.now(timezone.utc) + timedelta(days=2)
    published = client.post(
        "/api/v1/interview-slots",
        json={
            "application_id": str(other_application.id),
            "interview_type": "PHONE",
            "scheduled_at": future.isoformat(),
        },
        headers={"X-Tenant-Id": "acme"},
    )
    assert published.status_code == 201
    slot_id = published.json()["id"]

    listed = client.get(
        f"/api/v1/candidate-portal/applications/{other_application.id}/slots",
        headers=bearer,
    )
    assert listed.status_code == 404

    confirm = client.post(
        f"/api/v1/candidate-portal/applications/{other_application.id}/slots/{slot_id}/confirm",
        headers=bearer,
    )
    assert confirm.status_code == 404
    slots = [t for t in fake_db.added if isinstance(t, InterviewSlotModel)]
    assert all(s.interview_id is None for s in slots)


def test_reminder_only_on_confirmed_slot():
    fake_db = _FakeDB()
    client, bearer, application, _candidate = _seed_auth(fake_db)
    future = datetime.now(timezone.utc) + timedelta(days=2)
    published = client.post(
        "/api/v1/interview-slots",
        json={
            "application_id": str(application.id),
            "interview_type": "VIDEO",
            "scheduled_at": future.isoformat(),
        },
        headers={"X-Tenant-Id": "acme"},
    )
    slot_id = published.json()["id"]

    early = client.post(
        f"/api/v1/interview-slots/{slot_id}/remind",
        headers={"X-Tenant-Id": "acme"},
    )
    assert early.status_code == 400

    confirmed = client.post(
        f"/api/v1/candidate-portal/applications/{application.id}/slots/{slot_id}/confirm",
        headers=bearer,
    )
    assert confirmed.status_code == 200

    reminded = client.post(
        f"/api/v1/interview-slots/{slot_id}/remind",
        headers={"X-Tenant-Id": "acme"},
    )
    assert reminded.status_code == 200
    assert reminded.json()["reminded_at"] is not None
