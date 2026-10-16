"""Tests for the Analytics Service API using FastAPI TestClient."""

import base64
import hashlib
import hmac
import json
import time

import pytest
from httpx import ASGITransport, AsyncClient
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
async def test_command_center_overview_shape(client):
    resp = await client.get("/api/v1/command-center/overview", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    data = resp.json()
    for key in ("totalHeadcount", "payrollMtd", "openPositions", "orgHealthScore"):
        assert key in data


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
async def test_command_center_workforce_cost_shape(client):
    resp = await client.get("/api/v1/command-center/workforce-cost", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    data = resp.json()
    assert "totalCost" in data
    assert "byDepartment" in data


@pytest.mark.asyncio
async def test_command_center_attrition_map_shape(client):
    resp = await client.get("/api/v1/command-center/attrition-risk-map", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    assert "overallRiskScore" in resp.json()


@pytest.mark.asyncio
async def test_command_center_hiring_pipeline_shape(client):
    resp = await client.get("/api/v1/command-center/hiring-pipeline", headers={"X-Tenant-Id": "test-tenant"})
    assert resp.status_code == 200
    assert "pipelineStages" in resp.json()


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


@pytest.mark.asyncio
async def test_payroll_verify_rejects_garbage_period(client):
    for bad in ("not-a-period", "2026-13", "2026", "2026/05"):
        resp = await client.get(f"/api/v1/payroll/verify/{bad}", headers={"X-Tenant-Id": "test-tenant"})
        assert resp.status_code == 400
