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


def _make_token(secret: str = INTERNAL_JWT_SECRET, user_id: str = "u1") -> str:
    hdr = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(
        json.dumps({
            "sub": "test",
            "user_id": user_id,
            "user_role": "employee",
            "tenant_id": "test-tenant",
            "exp": int(time.time()) + 3600,
        }).encode()
    ).rstrip(b"=").decode()
    sig = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), f"{hdr}.{payload}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"{hdr}.{payload}.{sig}"


def _authed(user_id: str = "u1"):
    transport = ASGITransport(app=app)
    token = _make_token(user_id=user_id)
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


def _src() -> str:
    with open(os.path.join(os.path.dirname(__file__), "main.py"), encoding="utf-8") as fh:
        return fh.read()


def _fn_src(name: str) -> str:
    src = _src()
    start = src.index(f"async def {name}(")
    nxt = src.find("\n@app.", start + 1)
    return src[start:nxt if nxt != -1 else len(src)]


def test_ws_chat_sender_comes_from_claims():
    # The chat socket must build the entry from the verified connection
    # identity, never from msg.sender in the payload.
    body = _fn_src("websocket_chat")
    assert "websocket.state.user_id" in body, "chat must use the verified identity"
    assert '"sender": msg.sender' not in body, "chat must not trust the payload sender"


def test_ws_presence_user_id_comes_from_claims():
    body = _fn_src("websocket_presence")
    assert "websocket.state.user_id" in body, "presence must use the verified identity"
    assert "manager.presence[update.user_id] = entry" in body
    # update.user_id must be overwritten from the claims before the store write.
    assert body.index("update.user_id = websocket.state.user_id") < body.index(
        "manager.presence[update.user_id] = entry"
    ), "presence user_id must be bound to claims before storage"


def test_ws_handlers_refuse_missing_identity():
    # Both sockets must skip the message rather than store/broadcast without
    # a verified identity.
    for name in ("websocket_chat", "websocket_presence"):
        body = _fn_src(name)
        assert "continue" in body, f"{name} must skip messages with no identity"


@pytest.mark.asyncio
async def test_presence_update_and_get():
    async with _authed(user_id="u1") as client:
        # No user_id in the body: identity comes from the token.
        resp = await client.post("/api/v1/live/presence", json={
            "name": "Test User", "status": "online",
        })
        assert resp.status_code == 200
        resp2 = await client.get("/api/v1/live/presence")
        assert resp2.status_code == 200
        users = resp2.json()["users"]
        assert "users" in resp2.json()
        # Stored under the verified identity, not anything from the body.
        assert any(u.get("user_id") == "u1" for u in users)


@pytest.mark.asyncio
async def test_presence_cannot_impersonate_other_user():
    # Claiming a different user_id in the body must be refused, not honoured.
    async with _authed(user_id="u1") as client:
        resp = await client.post("/api/v1/live/presence", json={
            "user_id": "exec-1", "name": "The Executive", "status": "offline",
        })
        assert resp.status_code == 403
        resp2 = await client.get("/api/v1/live/presence")
        users = resp2.json()["users"]
        # No record may exist for the impersonated identity.
        assert not any(u.get("user_id") == "exec-1" for u in users)


@pytest.mark.asyncio
async def test_presence_requires_verified_identity():
    # A token with no user_id claim cannot write presence at all.
    async with _authed(user_id="") as client:
        resp = await client.post("/api/v1/live/presence", json={
            "name": "Ghost", "status": "online",
        })
        assert resp.status_code == 403


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
