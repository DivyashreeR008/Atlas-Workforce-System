import os
import pytest
from httpx import AsyncClient, ASGITransport

os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")
os.environ.setdefault("INTERNAL_JWT_SECRET", "test-secret")

from main import app  # noqa: E402
import crud  # noqa: E402


@pytest.mark.asyncio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "Workforce Planning Service" in data["status"]


@pytest.mark.asyncio
async def test_health_check_db_field():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "database" in data
        assert data["database"] in ("connected", "disconnected")


@pytest.mark.asyncio
async def test_dashboard_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/workforce/dashboard")
        assert resp.status_code == 401
        assert "Missing internal authentication" in resp.json().get("error", "")


def test_run_simulation_deterministic():
    first = crud.run_simulation(None, "tenant-a", "HEADCOUNT", {"current_headcount": 100, "growth_rate": 0.05})
    second = crud.run_simulation(None, "tenant-a", "HEADCOUNT", {"current_headcount": 100, "growth_rate": 0.05})
    assert first == second
    assert first["deterministic"] is True


def test_run_simulation_depends_on_parameters():
    first = crud.run_simulation(None, "tenant-a", "HEADCOUNT", {"current_headcount": 100})
    second = crud.run_simulation(None, "tenant-a", "HEADCOUNT", {"current_headcount": 200})
    assert first["results"] != second["results"]


def test_run_simulation_known_types_deterministic():
    for sim_type, params in (
        ("SKILL_GAP", {"department": "Engineering", "baseline_skill_level": 2, "target_skill_level": 5}),
        ("ATTRITION", {"current_headcount": 120, "base_attrition_rate": 0.1}),
    ):
        first = crud.run_simulation(None, "tenant-a", sim_type, params)
        second = crud.run_simulation(None, "tenant-a", sim_type, params)
        assert first == second
        assert first["deterministic"] is True
