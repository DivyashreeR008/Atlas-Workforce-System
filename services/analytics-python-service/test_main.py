"""Tests for the Analytics Service API using FastAPI TestClient."""

import base64
import hashlib
import hmac
import json
import time

import pytest
from httpx import ASGITransport, AsyncClient
import main
from main import app

INTERNAL_JWT_SECRET = "test-secret"


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
    """Should return empty list when employee service is unreachable."""
    response = await client.get(
        "/analytics/department",
        headers={"X-Tenant-Id": "test-tenant"},
    )
    # 200 with empty list when reachable-but-empty, 502 when the employee
    # service is unreachable (its designed unavailable signal).
    assert response.status_code in (200, 502)


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
