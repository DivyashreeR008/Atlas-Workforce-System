"""Tests for the ATS Service API using FastAPI TestClient."""

import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "ATS Service" in data["status"]


def test_list_jobs_empty(client):
    response = client.get("/api/v1/jobs", headers={"X-Tenant-Id": "test-tenant"})
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data


def test_list_jobs_pagination(client):
    response = client.get(
        "/api/v1/jobs?page=1&page_size=5",
        headers={"X-Tenant-Id": "test-tenant"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["page_size"] == 5


def test_get_nonexistent_job(client):
    response = client.get(
        "/api/v1/jobs/00000000-0000-0000-0000-000000000000",
        headers={"X-Tenant-Id": "test-tenant"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found"


def test_invalid_page_param(client):
    response = client.get(
        "/api/v1/jobs?page=0",
        headers={"X-Tenant-Id": "test-tenant"},
    )
    assert response.status_code == 422


def test_list_candidates_empty(client):
    response = client.get("/api/v1/candidates", headers={"X-Tenant-Id": "test-tenant"})
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


def test_list_applications_empty(client):
    response = client.get("/api/v1/applications", headers={"X-Tenant-Id": "test-tenant"})
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


def test_list_interviews_empty(client):
    response = client.get("/api/v1/interviews", headers={"X-Tenant-Id": "test-tenant"})
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


def test_list_offers_empty(client):
    response = client.get("/api/v1/offers", headers={"X-Tenant-Id": "test-tenant"})
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


def test_analytics_overview(client):
    response = client.get("/api/v1/analytics/overview", headers={"X-Tenant-Id": "test-tenant"})
    assert response.status_code == 200


def test_analytics_time_to_hire(client):
    response = client.get("/api/v1/analytics/time-to-hire", headers={"X-Tenant-Id": "test-tenant"})
    assert response.status_code == 200


def test_analytics_source_effectiveness(client):
    response = client.get("/api/v1/analytics/source-effectiveness", headers={"X-Tenant-Id": "test-tenant"})
    assert response.status_code == 200


def test_analytics_conversion_funnel(client):
    response = client.get("/api/v1/analytics/conversion-funnel", headers={"X-Tenant-Id": "test-tenant"})
    assert response.status_code == 200
