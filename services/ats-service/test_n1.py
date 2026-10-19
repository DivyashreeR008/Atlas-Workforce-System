"""Query-count harness: proves the batched reads in crud.py stay flat.

The functions under test carry the N+1 patterns found in the #457 audit.
Each test drives the same fetch through a scripted in-memory session that
counts every ``db.query`` call at two fixture sizes, and asserts the call
count is flat as rows scale from 10 to 1000.
"""

import uuid
from collections import defaultdict, deque

import pytest

import crud
from models import Application, CampusDrive, CampusRegistration, Candidate, Job, ResumeRanking

TENANT = "test-tenant"


class _FakeQuery:
    """Chainable stand-in for a SQLAlchemy Query backed by a scripted queue."""

    def __init__(self, session, key):
        self._session = session
        self._key = key

    def _peek(self):
        queue = self._session.queues[self._key]
        return queue[0] if queue else []

    def _pop(self):
        queue = self._session.queues[self._key]
        return queue.popleft() if queue else []

    def filter(self, *condition, **kwargs):
        return self

    def join(self, *target, **kwargs):
        return self

    def options(self, *loaders):
        return self

    def order_by(self, *criterion):
        return self

    def group_by(self, *criterion):
        return self

    def offset(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def all(self):
        answer = self._pop()
        return list(answer) if isinstance(answer, list) else [answer]

    def first(self):
        answer = self._pop()
        if isinstance(answer, list):
            return answer[0] if answer else None
        return answer

    def count(self):
        answer = self._peek()
        return len(answer) if isinstance(answer, list) else 1

    def scalar(self):
        return self._pop()


class _FakeSession:
    """Scripted session draining a per-entity queue on every query.

    Entity queries (``db.query(Job)``) take the class name; column- or
    aggregate-led queries (``db.query(Application.status, func.count(..))``)
    take the rendered fragment, mirroring how the reader can tell them
    apart. Each entry in a queue is one answer: a list for ``.all()`` /
    ``.count()`` / ``.first()``, a scalar for ``.scalar()``.
    """

    def __init__(self, scripted):
        self.queues = defaultdict(deque)
        for key, answers in scripted.items():
            self.queues[key].extend(answers)
        self.query_names = []
        self.commit_count = 0

    def query(self, *entities):
        label = getattr(entities[0], "__name__", None) or str(entities[0])
        self.query_names.append(label)
        return _FakeQuery(self, label)

    def add(self, *objs):
        pass

    def commit(self):
        self.commit_count += 1

    def refresh(self, obj):
        pass

    def total_queries(self):
        return len(self.query_names)


def _row(model, **overrides):
    """A namespace-shaped row carrying the real table so serialize_uuid works."""
    values = {}
    for column in model.__table__.columns:
        name = column.name
        if name in overrides:
            values[name] = overrides[name]
        elif name == "id":
            values[name] = overrides.get("id") or uuid.uuid4()
        elif name == "tenant_id":
            values[name] = TENANT
        else:
            values[name] = None
    return type("_FakeRow_" + model.__name__, (), {**values, "__table__": model.__table__})()


# --- list_applications: two batched IN queries per page, zero in the loop ---


@pytest.mark.parametrize("rows", [10, 1000])
def test_list_applications_query_count_flat(rows):
    applications = [
        _row(Application, job_id=f"job-{i % 5}", candidate_id=f"cand-{i}")
        for i in range(rows)
    ]
    jobs = [_row(Job, id=f"job-{i}", title=f"Job {i}") for i in range(5)]
    candidates = [
        _row(Candidate, id=f"cand-{i}", first_name="Ada", last_name=f"L{i}")
        for i in range(rows)
    ]
    session = _FakeSession({
        "Application": [applications],
        "Job": [jobs],
        "Candidate": [candidates],
    })

    result = crud.list_applications(session, TENANT, page=1, page_size=rows)
    assert result["total"] == rows
    assert result["items"][0]["candidate_name"] == "Ada L0"
    assert result["items"][0]["job_title"] == "Job 0"
    # page + one job batch + one candidate batch, independent of row count.
    assert session.total_queries() == 3


# --- rank_candidates_for_job: batched candidates + batched upsert source ---


@pytest.mark.parametrize("rows", [10, 1000])
def test_rank_candidates_query_count_flat(rows):
    job = _row(Job, id="job-1", title="Backend Engineer", requirements="python sql docker")
    candidate_ids = [f"cand-{i}" for i in range(rows)]
    candidates = [
        _row(Candidate, id=cid, skills=["python"], experience_years=3)
        for cid in candidate_ids
    ]
    rankings = [
        _row(ResumeRanking, candidate_id=cid, match_score=80.5, skills_match=70.0,
             experience_match=60.0, education_match=50.0, ai_notes="ok")
        for cid in candidate_ids
    ]
    session = _FakeSession({
        "Job": [[job]],
        "Candidate": [candidates],
        # first answer = batched existing-rankings lookup, second = final read
        "ResumeRanking": [[], rankings],
    })

    result = crud.rank_candidates_for_job(session, TENANT, job.id, candidate_ids)
    assert len(result["rankings"]) == rows
    assert result["rankings"][0]["candidate_name"] != "Unknown"
    # job + batched candidates + batched existing rankings + final rankings
    # read; the per-row candidate lookups and the outstanding-name IN query
    # (empty here - every ranked candidate came from this batch) never run.
    assert session.total_queries() == 4
    assert session.commit_count == 2  # one upsert commit + one rank pass


# --- list_campus_drives: one grouped count per page ---


@pytest.mark.parametrize("rows", [10, 1000])
def test_list_campus_drives_query_count_flat(rows):
    drives = [_row(CampusDrive, status="OPEN") for _ in range(rows)]
    counts = [(drive.id, 3) for drive in drives]
    session = _FakeSession({
        "CampusDrive": [drives],
        "CampusRegistration.drive_id": [counts],
    })

    result = crud.list_campus_drives(session, TENANT, page=1, page_size=rows)
    assert result["items"][0]["registration_count"] == 3
    # one drives page + one grouped count, independent of how many drives.
    assert session.total_queries() == 2


# --- get_recruitment_analytics: funnel from one grouped count ---


def test_recruitment_funnel_keeps_stage_order():
    """The grouped funnel reproduces the per-stage order and zero stages."""
    avg_label = "avg(EXTRACT(epoch FROM applications.updated_at - applications.application_date) / CAST(:param_1 AS FLOAT))"
    month_label = "date_trunc(:date_trunc_1, applications.created_at)"
    session = _FakeSession({
        "count(jobs.id)": [10, 7],
        "count(candidates.id)": [12],
        "count(applications.id)": [40],
        "count(interviews.id)": [2],
        "count(offers.id)": [6, 3],
        avg_label: [4.0],
        "Application.status": [[("APPLIED", 40), ("SCREENING", 20), ("HIRED", 5)]],
        "Candidate.source": [("PORTAL", 10)],
        "Job.department": [("Engineering", 7)],
        month_label: [("2026-05-01", 8)],
    })
    result = crud.get_recruitment_analytics(session, TENANT)
    stages = {entry["stage"]: entry["count"] for entry in result["conversion_funnel"]}
    assert stages["APPLIED"] == 40
    assert stages["HIRED"] == 5
    # Stages without rows stay visible with count 0, in declared order.
    assert result["conversion_funnel"][2]["stage"] == "INTERVIEW_STAGE_1"
    assert result["conversion_funnel"][2]["count"] == 0
