import base64
import hashlib
import hmac
import json
import os
import time

import pytest
from httpx import AsyncClient, ASGITransport

os.environ.setdefault("INTERNAL_JWT_SECRET", "test-secret")

from main import app  # noqa: E402

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
        assert data["service"] == "live-service"


@pytest.mark.asyncio
async def test_presence_update_and_get():
    async with _authed() as client:
        resp = await client.post("/api/v1/live/presence", json={
            "user_id": "u1", "name": "Test User", "status": "online",
        })
        assert resp.status_code == 200
        resp2 = await client.get("/api/v1/live/presence")
        assert resp2.status_code == 200
        assert "users" in resp2.json()


@pytest.mark.asyncio
async def test_poll_create_and_list():
    async with _authed() as client:
        resp = await client.post("/api/v1/live/poll/create", json={
            "poll_id": "p1", "question": "Lunch?", "options": ["yes", "no"], "created_by": "u1",
        })
        assert resp.status_code == 200
        resp2 = await client.get("/api/v1/live/polls")
        assert resp2.status_code == 200
        assert "polls" in resp2.json()


@pytest.mark.asyncio
async def test_incident_report_and_list():
    async with _authed() as client:
        resp = await client.post("/api/v1/live/incident", json={
            "incident_id": "i1", "title": "Outage", "severity": "high",
            "status": "open", "reported_by": "u1",
        })
        assert resp.status_code == 200
        resp2 = await client.get("/api/v1/live/incidents")
        assert resp2.status_code == 200
        assert "incidents" in resp2.json()


@pytest.mark.asyncio
async def test_channel_history_and_stats():
    async with _authed() as client:
        resp = await client.get("/api/v1/live/history/presence")
        assert resp.status_code == 200
        assert resp.json()["channel"] == "presence"
        resp2 = await client.get("/api/v1/live/stats")
        assert resp2.status_code == 200
        assert "channels" in resp2.json()


@pytest.mark.asyncio
async def test_publish_event_ok():
    async with _authed() as client:
        resp = await client.post("/api/v1/live/publish/presence?event=presence.update", json={"hello": "world"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "published"
