"""Tests for the Analytics Service API using FastAPI TestClient."""

import base64
import hashlib
import hmac
import json
import os
import time

import pytest
from httpx import ASGITransport, AsyncClient

INTERNAL_JWT_SECRET = "test-secret"
os.environ.setdefault("INTERNAL_JWT_SECRET", INTERNAL_JWT_SECRET)

import main
from main import app


def _make_internal_token(secret: str, tenant_id: str = "test-tenant") -> str:
    hdr = base64.urlsafe_b64encode(
        json.dumps({"alg": "HS256", "typ": "JWT"}).encode()
    ).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(
        json.dumps({"sub": "test", "tenant_id": tenant_id, "exp": int(time.time()) + 3600}).encode()
    ).rstrip(b"=").decode()
    sig = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), f"{hdr}.{payload}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"{hdr}.{payload}.{sig}"


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    token = _make_internal_token(INTERNAL_JWT_SECRET, tenant_id="test-tenant")
    return AsyncClient(transport=transport, base_url="http://test", headers={"x-internal-auth": token})


@pytest.fixture(autouse=True)
def clear_department_cache():
    main.invalidate_department_cache()
    yield
    main.invalidate_department_cache()


def _decode_internal_token(token):
    hdr, payload, sig = token.split(".")
    expected = base64.urlsafe_b64encode(
        hmac.new(INTERNAL_JWT_SECRET.encode(), f"{hdr}.{payload}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    assert hmac.compare_digest(expected, sig), "outbound token must be signed with INTERNAL_JWT_SECRET"
    padded = payload + "=" * (4 - len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(padded))


class FakeEmployeeService:
    """Stand-in for the employee service pagination contract.

    Serves employees in page/page_size windows and reports total/total_pages
    the way employee-python-service/main.py does. Records every request so
    tests can assert the auth header and pagination parameters.
    """

    def __init__(self, employees_by_tenant):
        self.employees_by_tenant = employees_by_tenant
        self.calls = []

    def get(self, url, params=None, headers=None, timeout=None):
        self.calls.append({"url": url, "params": dict(params or {}), "headers": dict(headers or {})})
        tenant_id = (headers or {}).get("X-Tenant-Id", "")
        employees = self.employees_by_tenant.get(tenant_id, [])
        page = int((params or {}).get("page", 1))
        page_size = int((params or {}).get("page_size", 100))
        start = (page - 1) * page_size
        items = employees[start:start + page_size]
        total = len(employees)
        total_pages = max(1, -(-total // page_size))
        return FakeResponse(200, {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        })


class FakeResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload
        self.json_error = None

    def json(self):
        if self.json_error:
            raise self.json_error
        return self._payload


@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "Analytics Service" in data["status"]


@pytest.mark.asyncio
async def test_performance_prediction(client):
    response = await client.get("/analytics/performance")
    assert response.status_code == 200
    data = response.json()
    assert data["predictions_ready"] is True
    assert "top_performer_id" in data
    assert "score" in data


@pytest.mark.asyncio
async def test_department_analytics_no_data(client):
    """An unreachable employee service is a 502, never an empty tenant."""
    response = await client.get(
        "/analytics/department",
        headers={"X-Tenant-Id": "test-tenant"},
    )
    assert response.status_code == 502
    assert "Employee service" in response.json()["detail"]


@pytest.mark.asyncio
async def test_department_analytics_paginates_and_aggregates(client, monkeypatch):
    """Multi-page tenants are counted in full, capped pages never truncate silently."""
    employees = (
        [{"department": "Engineering"} for _ in range(120)]
        + [{"department": "Sales"} for _ in range(30)]
    )
    backend = FakeEmployeeService({"test-tenant": employees})
    monkeypatch.setattr("main.requests.get", backend.get)

    response = await client.get("/analytics/department", headers={"X-Tenant-Id": "test-tenant"})
    assert response.status_code == 200
    data = response.json()
    assert {d["department"]: d["headcount"] for d in data} == {"Engineering": 120, "Sales": 30}
    assert sum(d["headcount"] for d in data) == 150

    assert len(backend.calls) == 2, "150 rows at page_size 100 needs two upstream pages"
    assert [c["params"]["page"] for c in backend.calls] == [1, 2]
    for call in backend.calls:
        assert call["params"]["page_size"] == 100
        token = call["headers"].get("x-internal-auth", "")
        assert token, "outbound call must carry the internal auth header"
        claims = _decode_internal_token(token)
        assert claims["tenant_id"] == "test-tenant"
        assert claims["sub"] == "analytics-service"


@pytest.mark.asyncio
async def test_department_analytics_credentials_rejected_by_upstream(client, monkeypatch):
    """A 401 from the employee service surfaces as 502 naming the dependency."""
    def unauthorized(url, params=None, headers=None, timeout=None):
        return FakeResponse(401, {"detail": "Missing internal authentication"})

    monkeypatch.setattr("main.requests.get", unauthorized)
    response = await client.get("/analytics/department", headers={"X-Tenant-Id": "test-tenant"})
    assert response.status_code == 502
    assert "status 401" in response.json()["detail"]


@pytest.mark.asyncio
async def test_department_analytics_empty_tenant_is_200(client, monkeypatch):
    """A reachable tenant with no employees is a genuine empty result."""
    backend = FakeEmployeeService({"test-tenant": []})
    monkeypatch.setattr("main.requests.get", backend.get)
    response = await client.get("/analytics/department", headers={"X-Tenant-Id": "test-tenant"})
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_department_analytics_uses_ttl_cache(client, monkeypatch):
    """Repeated reads within the TTL are served from the cache, not upstream."""
    backend = FakeEmployeeService({"test-tenant": [{"department": "Engineering"}]})
    monkeypatch.setattr("main.requests.get", backend.get)
    first = await client.get("/analytics/department", headers={"X-Tenant-Id": "test-tenant"})
    second = await client.get("/analytics/department", headers={"X-Tenant-Id": "test-tenant"})
    assert first.json() == second.json() == [{"department": "Engineering", "headcount": 1}]
    assert len(backend.calls) == 1

    main.invalidate_department_cache("test-tenant")
    third = await client.get("/analytics/department", headers={"X-Tenant-Id": "test-tenant"})
    assert third.status_code == 200
    assert len(backend.calls) == 2


@pytest.mark.asyncio
async def test_payroll_analytics_no_db(client):
    """Should return empty list when database is not connected."""
    response = await client.get(
        "/analytics/payroll",
        headers={"X-Tenant-Id": "test-tenant"},
    )
    # We expect either 200 with empty list or 500 depending on DB connection
    assert response.status_code in (200, 500)


@pytest.mark.asyncio
async def test_ai_insights_mock(client):
    """AI insights should return mock data when no API key is configured."""
    response = await client.post(
        "/analytics/ai-insights",
        headers={"X-Tenant-Id": "test-tenant"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "insight" in data


@pytest.mark.asyncio
async def test_command_center_overview(client, monkeypatch):
    monkeypatch.setattr("main.fetch_tenant_employees", lambda tenant_id: [{"_id": "emp-1"}])
    monkeypatch.setattr("main.fetch_payroll_mtd", lambda tenant_id: 1234.0)
    monkeypatch.setattr("main.fetch_ats_open_positions", lambda tenant_id: 4)
    monkeypatch.setattr("main.fetch_ats_time_to_hire_days", lambda tenant_id: 30.0)
    response = await client.get(
        "/api/v1/command-center/overview",
        headers={"X-Tenant-Id": "test-tenant"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["totalHeadcount"] == 1
    assert data["payrollMtd"] == 1234.0
    assert data["openPositions"] == 4
    assert data["orgHealthScore"] is None
    assert data["dataSource"]["kind"] == "mixed"
    assert "orgHealthScore" in data["dataSource"]["notLiveFields"]


@pytest.mark.asyncio
async def test_command_center_org_health(client):
    response = await client.get(
        "/api/v1/command-center/org-health",
        headers={"X-Tenant-Id": "test-tenant"},
    )
    assert response.status_code == 200
    assert "overall" in response.json()


@pytest.mark.asyncio
async def test_command_center_activity_feed(client):
    response = await client.get(
        "/api/v1/command-center/activity-feed",
        headers={"X-Tenant-Id": "test-tenant"},
    )
    assert response.status_code == 200
    assert "activities" in response.json()


@pytest.mark.asyncio
async def test_command_center_overview_shape(client, monkeypatch):
    monkeypatch.setattr("main.fetch_tenant_employees", lambda tenant_id: [])
    monkeypatch.setattr("main.fetch_payroll_mtd", lambda tenant_id: 0.0)
    monkeypatch.setattr("main.fetch_ats_open_positions", lambda tenant_id: 0)
    monkeypatch.setattr("main.fetch_ats_time_to_hire_days", lambda tenant_id: None)
    resp = await client.get("/api/v1/command-center/overview", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    data = resp.json()
    for key in ("totalHeadcount", "payrollMtd", "openPositions", "orgHealthScore", "asOf", "dataSource"):
        assert key in data
    assert data["dataSource"]["kind"] == "mixed"
    assert data["asOf"]


@pytest.mark.asyncio
async def test_command_center_org_health_shape(client):
    resp = await client.get("/api/v1/command-center/org-health", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    data = resp.json()
    assert "overall" in data
    assert "dimensions" in data
    assert len(data["dimensions"]) >= 1


@pytest.mark.asyncio
async def test_command_center_heatmap_shape(client):
    resp = await client.get("/api/v1/command-center/department-heatmap", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    assert "departments" in resp.json()


@pytest.mark.asyncio
async def test_command_center_workforce_cost_shape(client, monkeypatch):
    monkeypatch.setattr("main.fetch_payroll_by_employee", lambda tenant_id: [
        {"employee_id": "emp-1", "base_salary": 1000.0, "allowances": 100.0, "tax": 150.0},
        {"employee_id": "emp-2", "base_salary": 2000.0, "allowances": 200.0, "tax": 300.0},
    ])
    monkeypatch.setattr("main.fetch_payroll_by_period", lambda tenant_id, limit=6: [
        {"period": "2026-04", "cost": 3000.0},
        {"period": "2026-05", "cost": 3300.0},
    ])
    monkeypatch.setattr("main.fetch_tenant_employees", lambda tenant_id: [
        {"_id": "emp-1", "department": "Engineering"},
        {"_id": "emp-2", "department": "Sales"},
    ])
    resp = await client.get("/api/v1/command-center/workforce-cost", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["totalCost"] == 3300.0
    assert data["totalBenefits"] is None
    assert {d["department"] for d in data["byDepartment"]} == {"Engineering", "Sales"}
    assert data["byDepartment"][0]["percentOfTotal"] > 0


@pytest.mark.asyncio
async def test_command_center_attrition_map_shape(client):
    resp = await client.get("/api/v1/command-center/attrition-risk-map", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    assert "overallRiskScore" in resp.json()


@pytest.mark.asyncio
async def test_command_center_hiring_pipeline_shape(client, monkeypatch):
    monkeypatch.setattr("main.fetch_ats_pipeline_snapshot", lambda tenant_id: (
        {"total_candidates": 12, "by_stage": {"NEW": 8, "SCREENED": 4},
         "by_job": [{"job_id": "job-1", "applications": 3}]},
        [{"id": "job-1", "department": "Engineering"}],
    ))
    monkeypatch.setattr("main.fetch_ats_time_to_hire_days", lambda tenant_id: 21.0)
    resp = await client.get("/api/v1/command-center/hiring-pipeline", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["openPositions"] == 1
    assert data["activeCandidates"] == 12
    assert data["pipelineStages"] == [{"stage": "NEW", "count": 8}, {"stage": "SCREENED", "count": 4}]
    assert data["byDepartment"] == [
        {"department": "Engineering", "openings": 1, "candidates": 3, "interviews": None, "offers": None}
    ]
    assert data["timeToHireAvg"] == 21.0
    assert data["upcomingInterviews"] is None


@pytest.mark.asyncio
async def test_command_center_budget_forecast_shape(client):
    resp = await client.get("/api/v1/command-center/budget-forecast", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    assert "totalBudget" in resp.json()


@pytest.mark.asyncio
async def test_command_center_utilization_shape(client):
    resp = await client.get("/api/v1/command-center/utilization", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    assert "overallUtilization" in resp.json()


@pytest.mark.asyncio
async def test_command_center_benchmarking_shape(client):
    resp = await client.get("/api/v1/command-center/benchmarking", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    assert "companyAvg" in resp.json()


@pytest.mark.asyncio
async def test_command_center_ai_briefing_shape(client):
    resp = await client.get("/api/v1/command-center/ai-briefing", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    assert "executiveSummary" in resp.json()


@pytest.mark.asyncio
async def test_command_center_risk_dashboard_shape(client):
    resp = await client.get("/api/v1/command-center/risk-dashboard", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    assert "overallRiskScore" in resp.json()


@pytest.mark.asyncio
async def test_command_center_activity_feed_shape(client):
    resp = await client.get("/api/v1/command-center/activity-feed", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    assert "activities" in resp.json()


NOT_LIVE_VIEWS = [
    "/api/v1/command-center/org-health",
    "/api/v1/command-center/department-heatmap",
    "/api/v1/command-center/attrition-risk-map",
    "/api/v1/command-center/budget-forecast",
    "/api/v1/command-center/utilization",
    "/api/v1/command-center/benchmarking",
    "/api/v1/command-center/ai-briefing",
    "/api/v1/command-center/risk-dashboard",
    "/api/v1/command-center/activity-feed",
]


def _tenant_client(tenant_id):
    transport = ASGITransport(app=app)
    token = _make_internal_token(INTERNAL_JWT_SECRET, tenant_id=tenant_id)
    return AsyncClient(transport=transport, base_url="http://test", headers={"x-internal-auth": token})


@pytest.mark.asyncio
async def test_not_live_views_are_explicitly_labelled(client):
    """Every still-canned command-center view declares its provenance."""
    for path in NOT_LIVE_VIEWS:
        resp = await client.get(path, headers={"X-Tenant-Id": "test-tenant"})
        assert resp.status_code == 200, path
        data = resp.json()
        assert data["dataSource"]["kind"] == "not-live", path
        assert data["dataSource"]["basis"], path
        assert data["asOf"] == main.CANNED_FIXTURE_AS_OF, path


@pytest.mark.asyncio
async def test_live_views_differ_between_tenants(monkeypatch):
    """The definitive test a canned view can never pass: different tenants,
    different numbers."""

    def employees_for(tenant_id):
        if tenant_id == "tenant-a":
            return [{"_id": "a1", "department": "Engineering"},
                    {"_id": "a2", "department": "Engineering"}]
        return [{"_id": "b1", "department": "Sales"}]

    def payroll_for(tenant_id):
        if tenant_id == "tenant-a":
            return [{"employee_id": "a1", "base_salary": 1000.0, "allowances": 0.0, "tax": 100.0}]
        return [{"employee_id": "b1", "base_salary": 9000.0, "allowances": 500.0, "tax": 800.0}]

    def pipeline_for(tenant_id):
        if tenant_id == "tenant-a":
            return ({"total_candidates": 3, "by_stage": {"NEW": 3}, "by_job": []},
                    [{"id": "j1", "department": "Engineering"}])
        return ({"total_candidates": 9, "by_stage": {"NEW": 9}, "by_job": []},
                [{"id": "j2", "department": "Sales"}, {"id": "j3", "department": "Sales"}])

    monkeypatch.setattr("main.fetch_tenant_employees", employees_for)
    monkeypatch.setattr("main.fetch_payroll_mtd", lambda tenant_id: 100.0 if tenant_id == "tenant-a" else 200.0)
    monkeypatch.setattr("main.fetch_ats_open_positions", lambda tenant_id: 1 if tenant_id == "tenant-a" else 2)
    monkeypatch.setattr("main.fetch_ats_time_to_hire_days", lambda tenant_id: 10.0 if tenant_id == "tenant-a" else 20.0)
    monkeypatch.setattr("main.fetch_payroll_by_employee", payroll_for)
    monkeypatch.setattr("main.fetch_payroll_by_period", lambda tenant_id, limit=6: [])
    monkeypatch.setattr("main.fetch_ats_pipeline_snapshot", pipeline_for)

    results = {}
    for tenant_id in ("tenant-a", "tenant-b"):
        async with _tenant_client(tenant_id) as c:
            headers = {"X-Tenant-Id": tenant_id}
            overview = (await c.get("/api/v1/command-center/overview", headers=headers)).json()
            pipeline = (await c.get("/api/v1/command-center/hiring-pipeline", headers=headers)).json()
            cost = (await c.get("/api/v1/command-center/workforce-cost", headers=headers)).json()
        results[tenant_id] = (overview, pipeline, cost)
        for payload in (overview, pipeline, cost):
            assert payload["dataSource"]["kind"] == "mixed"
            assert payload["dataSource"]["services"]
            assert payload["asOf"]

    overview_a, pipeline_a, cost_a = results["tenant-a"]
    overview_b, pipeline_b, cost_b = results["tenant-b"]
    assert overview_a["totalHeadcount"] == 2 and overview_b["totalHeadcount"] == 1
    assert overview_a["payrollMtd"] == 100.0 and overview_b["payrollMtd"] == 200.0
    assert pipeline_a["openPositions"] == 1 and pipeline_b["openPositions"] == 2
    assert pipeline_a["activeCandidates"] == 3 and pipeline_b["activeCandidates"] == 9
    assert cost_a["totalPayroll"] == 1000.0 and cost_b["totalPayroll"] == 9500.0
    assert cost_a["byDepartment"][0]["department"] == "Engineering"
    assert cost_b["byDepartment"][0]["department"] == "Sales"


@pytest.mark.asyncio
async def test_overview_marks_failed_sources_unavailable(monkeypatch):
    """A dead dependency yields nulls named in unavailableFields, not fixtures."""
    def failing(tenant_id):
        raise main.HTTPException(status_code=502, detail="Employee service unavailable")

    monkeypatch.setattr("main.fetch_tenant_employees", failing)
    monkeypatch.setattr("main.fetch_payroll_mtd", failing)
    monkeypatch.setattr("main.fetch_ats_open_positions", failing)
    monkeypatch.setattr("main.fetch_ats_time_to_hire_days", failing)

    async with _tenant_client("tenant-a") as c:
        resp = await c.get("/api/v1/command-center/overview", headers={"X-Tenant-Id": "tenant-a"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["totalHeadcount"] is None
    assert data["payrollMtd"] is None
    assert data["openPositions"] is None
    assert set(data["dataSource"]["unavailableFields"]) == {
        "totalHeadcount", "payrollMtd", "openPositions", "avgTimeToHire"
    }


@pytest.mark.asyncio
async def test_hiring_pipeline_surfaces_ats_outage(monkeypatch):
    """The pipeline view is ATS-only: an ATS outage is a 502, not empty numbers."""
    def failing(tenant_id):
        raise main.HTTPException(status_code=502, detail="ATS service unavailable (upstream status 503)")

    monkeypatch.setattr("main.fetch_ats_pipeline_snapshot", failing)
    async with _tenant_client("tenant-a") as c:
        resp = await c.get("/api/v1/command-center/hiring-pipeline", headers={"X-Tenant-Id": "tenant-a"})
    assert resp.status_code == 502
    assert "ATS service" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_payroll_verify_rejects_garbage_period(client):
    for bad in ("not-a-period", "2026-13", "2026", "2026/05"):
        resp = await client.get(f"/api/v1/payroll/verify/{bad}", headers={"X-Tenant-Id": "test-tenant"})
        assert resp.status_code == 400


# --- Shared read cache (atlas_observability.read_cache) ---


@pytest.fixture(autouse=True)
def _clean_read_cache():
    main.read_cache.clear()
    yield
    main.read_cache.clear()


def _test_read_cache(**kwargs):
    """A ReadCache isolated from the service's module-level instance."""
    return main.ReadCache("test-service", **kwargs)


@pytest.mark.asyncio
async def test_department_analytics_served_from_cache(client, monkeypatch):
    """A second department request within the TTL performs no upstream call."""
    calls = []
    employees = [
        {"_id": "e1", "department": "Engineering"},
        {"_id": "e2", "department": "Engineering"},
        {"_id": "e3", "department": "Sales"},
    ]

    def fetch(tenant_id):
        calls.append(tenant_id)
        return list(employees)

    monkeypatch.setattr("main.fetch_tenant_employees", fetch)
    resp = await client.get("/analytics/department", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    assert resp.json() == [
        {"department": "Engineering", "headcount": 2},
        {"department": "Sales", "headcount": 1},
    ]
    resp = await client.get("/analytics/department", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    assert resp.json() == [
        {"department": "Engineering", "headcount": 2},
        {"department": "Sales", "headcount": 1},
    ]
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_department_employee_deletion_invalidates_cache(client, monkeypatch):
    """Write-path invalidation: after the employee-deleted event the next
    read reflects the new headcounts immediately."""
    calls = []
    employees = [
        {"_id": "e1", "department": "Engineering"},
        {"_id": "e2", "department": "Engineering"},
    ]

    def fetch(tenant_id):
        calls.append(tenant_id)
        return list(employees)

    monkeypatch.setattr("main.fetch_tenant_employees", fetch)
    first = (await client.get("/analytics/department", headers={"X-Tenant-Id": "test-tenant"})).json()
    assert first == [{"department": "Engineering", "headcount": 2}]

    # The write: the employee.py deletion path also emits employee.deleted,
    # whose consumer calls the invalidate hook.
    employees.remove({"_id": "e2", "department": "Engineering"})
    main.invalidate_department_cache("test-tenant")

    second = (await client.get("/analytics/department", headers={"X-Tenant-Id": "test-tenant"})).json()
    assert second == [{"department": "Engineering", "headcount": 1}]
    assert len(calls) == 2


def test_read_cache_single_flight():
    """N concurrent misses on one key produce exactly one loader call."""
    import threading
    from concurrent.futures import ThreadPoolExecutor

    cache = _test_read_cache()
    call_count = []
    key = cache.make_key("single-flight", "tenant-1")

    def loader():
        call_count.append(1)
        time.sleep(0.05)
        return {"ticket": 1}

    def worker():
        return cache.cached(key, 60, loader, endpoint="single-flight")

    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(lambda _: worker(), range(10)))

    assert results[0] == {"ticket": 1}
    assert all(r == {"ticket": 1} for r in results)
    assert len(call_count) == 1


def test_read_cache_write_invalidate_then_read_reflects_new_value():
    """Invalidation between a write and the next read returns fresh data."""
    cache = _test_read_cache()
    key = cache.make_key("freshness", "tenant-1")
    payloads = iter([{"version": 1}, {"version": 2}])

    assert cache.cached(key, 60, lambda: next(payloads), endpoint="freshness") == {"version": 1}
    cache.invalidate([key], endpoint="freshness")
    assert cache.cached(key, 60, lambda: next(payloads), endpoint="freshness") == {"version": 2}


def test_read_cache_tenant_keying_isolates_tenants():
    cache = _test_read_cache()
    assert cache.make_key("department", "tenant-a") != cache.make_key("department", "tenant-b")
    assert "tenant_a" in cache.make_key("department", "tenant:a")


def test_read_cache_ttl_expiry_and_dedegradation():
    """An expired entry recomputes; a dead Redis degrades to the local
    store instead of failing the read."""
    cache = _test_read_cache(redis_url="redis://127.0.0.1:1/0")
    assert cache.backend == "local"

    counter = [0]
    key = cache.make_key("degrade", "tenant-1")

    def loader():
        counter[0] += 1
        return {"n": counter[0]}

    assert cache.cached(key, 0.02, loader, endpoint="degrade") == {"n": 1}
    time.sleep(0.05)
    assert cache.cached(key, 0.02, loader, endpoint="degrade") == {"n": 2}
    # Still live within TTL now: hit from the local mirror.
    assert cache.cached(key, 0.02, loader, endpoint="degrade") == {"n": 2}
    assert counter[0] == 2
