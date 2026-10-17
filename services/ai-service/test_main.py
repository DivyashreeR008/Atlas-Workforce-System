import base64
import hashlib
import hmac
import json
import os
import time

import pytest
from httpx import AsyncClient, ASGITransport

os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("INTERNAL_JWT_SECRET", "test-secret")

import main as app_module  # noqa: E402
from main import app  # noqa: E402

app_module.INTERNAL_JWT_SECRET = os.environ.get("INTERNAL_JWT_SECRET", "test-secret")
INTERNAL_JWT_SECRET = "test-secret"


def _make_token(secret: str = INTERNAL_JWT_SECRET) -> str:
    hdr = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(
        json.dumps({"sub": "test", "tenant_id": "test-tenant", "exp": int(time.time()) + 3600}).encode()
    ).rstrip(b"=").decode()
    sig = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), f"{hdr}.{payload}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"{hdr}.{payload}.{sig}"


def _authed():
    transport = ASGITransport(app=app)
    token = _make_token()
    return AsyncClient(transport=transport, base_url="http://test", headers={"x-internal-auth": token})


@pytest.mark.asyncio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["service"] == "ai-service"


@pytest.mark.asyncio
async def test_copilot_hr_ok():
    async with _authed() as client:
        resp = await client.post("/api/v1/ai/hr/copilot", json={"query": "Hello"})
        assert resp.status_code == 200
        assert "reply" in resp.json()


@pytest.mark.asyncio
async def test_workforce_forecasting_ok():
    async with _authed() as client:
        resp = await client.post("/api/v1/ai/workforce-forecasting", json={})
        assert resp.status_code == 200
        assert "forecasts" in resp.json()


@pytest.mark.asyncio
async def test_knowledge_search_ok():
    async with _authed() as client:
        resp = await client.post("/api/v1/ai/knowledge-search", json={"query": "benefits"})
        assert resp.status_code == 200
        assert "results" in resp.json()


@pytest.mark.asyncio
async def test_shift_optimization_ok():
    async with _authed() as client:
        resp = await client.post("/api/v1/ai/shift-optimization", json={
            "department": "Engineering", "date_range": ["2026-01-01", "2026-01-07"],
        })
        assert resp.status_code == 200
        assert "optimized_schedule" in resp.json()


@pytest.mark.asyncio
async def test_budget_forecasting_ok():
    async with _authed() as client:
        resp = await client.post("/api/v1/ai/budget-forecasting", json={
            "department": "Engineering", "current_budget": 100000,
        })
        assert resp.status_code == 200
        assert "monthly_projections" in resp.json()
