"""Webhook signing tests for issue #433.

Covers the receiver-facing contract (versioned HMAC-SHA256 over
timestamp.body with a replay window), the rotation grace window where both
the old and the new secret are valid, and the delivery-detail artifacts that
let an integrator reproduce a request with curl.
"""
import json
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")
os.environ.setdefault("INTERNAL_JWT_SECRET", "test-jwt-secret")

import event_router  # noqa: E402
import webhook_engine  # noqa: E402
from crud import (  # noqa: E402
    WEBHOOK_UPDATE_FIELDS,
    MassAssignmentError,
    apply_updates,
    build_delivery_detail,
    create_webhook,
    rotate_webhook_secret,
)
from models import Webhook, WebhookDeliveryLog  # noqa: E402
from webhook_engine import (  # noqa: E402
    DEFAULT_TOLERANCE_SEC,
    build_curl_example,
    compute_timestamped_signature,
    format_signature_header,
    is_timestamp_fresh,
    parse_signature_header,
    verify_signature,
)

KNOWN_SECRET = "whsec_atlas_test_secret"
KNOWN_PREVIOUS_SECRET = "whsec_atlas_previous_secret"
KNOWN_TIMESTAMP = 1700000000
KNOWN_BODY = b'{"event_type":"payroll.run.completed","tenant_id":"tenant-a","amount":"1234.56"}'
KNOWN_SIGNATURE = "2b1bfa1bf5f4f7665351ce28588109ee5c8738a3c8f8adc210f40dec8461217b"
KNOWN_PREVIOUS_SIGNATURE = "9c2e76554ea00e0f1630016de4fdbc591b5b0eb96947ab1103990003e559e140"


def _mint_internal_token(secret: str = "test-jwt-secret") -> str:
    import base64
    import hashlib
    import hmac

    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256"}).encode()).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(
        json.dumps({"sub": "integration-service", "tenant_id": "tenant-a", "exp": int(time.time()) + 3600}).encode()
    ).rstrip(b"=").decode()
    signing_input = f"{header}.{payload}"
    signature = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"{signing_input}.{signature}"


def _fake_webhook(**overrides) -> Webhook:
    now = datetime.now(timezone.utc)
    values = {
        "id": uuid4(),
        "tenant_id": "tenant-a",
        "name": "billing-hook",
        "url": "https://example.com/hook",
        "secret": "whsec_current",
        "previous_secret": None,
        "secret_rotated_at": None,
        "secret_grace_expires_at": None,
        "event_types": ["payroll.run.completed"],
        "headers": {},
        "retry_count": 3,
        "retry_interval_sec": 60,
        "timeout_sec": 30,
        "enabled": True,
        "last_triggered_at": None,
        "created_at": now,
        "updated_at": now,
    }
    values.update(overrides)
    return Webhook(**values)


def _fake_delivery_log(**overrides) -> WebhookDeliveryLog:
    now = datetime.now(timezone.utc)
    values = {
        "id": uuid4(),
        "webhook_id": uuid4(),
        "tenant_id": "tenant-a",
        "event_type": "payroll.run.completed",
        "payload": {"event_type": "payroll.run.completed"},
        "signature": None,
        "signature_timestamp": None,
        "request_body": None,
        "status": "DELIVERED",
        "status_code": 200,
        "response_body": "ok",
        "attempts": 1,
        "max_attempts": 3,
        "next_retry_at": None,
        "delivered_at": now,
        "created_at": now,
    }
    values.update(overrides)
    return WebhookDeliveryLog(**values)


# ── Signature computation ─────────────────────────────────────────


def test_known_vector_matches_frozen_signature():
    # Frozen vector: HMAC-SHA256(secret, b"1700000000." + body). If this
    # changes, every deployed receiver breaks - so it must never change.
    assert compute_timestamped_signature(KNOWN_BODY, KNOWN_SECRET, KNOWN_TIMESTAMP) == KNOWN_SIGNATURE
    assert compute_timestamped_signature(KNOWN_BODY, KNOWN_PREVIOUS_SECRET, KNOWN_TIMESTAMP) == KNOWN_PREVIOUS_SIGNATURE


def test_header_uses_version_prefix():
    header = format_signature_header(["abc123"])
    assert header == "v1=abc123"
    assert parse_signature_header(header) == ["abc123"]


def test_parse_signature_header_accepts_multiple_entries_and_commas():
    header = format_signature_header(["aaa", "bbb"])
    assert header == "v1=aaa v1=bbb"
    assert parse_signature_header(header) == ["aaa", "bbb"]
    assert parse_signature_header("v1=aaa,v1=bbb") == ["aaa", "bbb"]
    assert parse_signature_header("garbage") == []
    assert parse_signature_header(None) == []


def test_round_trip_accepts_untampered_body():
    header = format_signature_header([compute_timestamped_signature(KNOWN_BODY, KNOWN_SECRET, KNOWN_TIMESTAMP)])
    assert verify_signature(KNOWN_BODY, header, KNOWN_TIMESTAMP, [KNOWN_SECRET], now=KNOWN_TIMESTAMP)


def test_tampered_body_rejected():
    header = format_signature_header([compute_timestamped_signature(KNOWN_BODY, KNOWN_SECRET, KNOWN_TIMESTAMP)])
    tampered = KNOWN_BODY.replace(b"1234.56", b"9999.99")
    assert not verify_signature(tampered, header, KNOWN_TIMESTAMP, [KNOWN_SECRET], now=KNOWN_TIMESTAMP)


def test_stale_timestamp_rejected_inside_and_outside_window():
    header = format_signature_header([compute_timestamped_signature(KNOWN_BODY, KNOWN_SECRET, KNOWN_TIMESTAMP)])
    assert is_timestamp_fresh(KNOWN_TIMESTAMP, now=KNOWN_TIMESTAMP + DEFAULT_TOLERANCE_SEC)
    assert not is_timestamp_fresh(KNOWN_TIMESTAMP, now=KNOWN_TIMESTAMP + DEFAULT_TOLERANCE_SEC + 1)
    assert not verify_signature(
        KNOWN_BODY, header, KNOWN_TIMESTAMP, [KNOWN_SECRET], now=KNOWN_TIMESTAMP + DEFAULT_TOLERANCE_SEC + 1
    )
    assert not is_timestamp_fresh("not-a-timestamp")


def test_wrong_secret_rejected():
    header = format_signature_header([compute_timestamped_signature(KNOWN_BODY, KNOWN_SECRET, KNOWN_TIMESTAMP)])
    assert not verify_signature(KNOWN_BODY, header, KNOWN_TIMESTAMP, ["whsec_someone_else"], now=KNOWN_TIMESTAMP)


# ── Rotation grace window ─────────────────────────────────────────


def test_grace_window_keeps_previous_secret_valid():
    webhook = _fake_webhook(
        secret="whsec_new",
        previous_secret="whsec_old",
        secret_rotated_at=datetime.now(timezone.utc),
        secret_grace_expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    assert webhook.previous_secret_usable()
    assert webhook.signing_secrets() == ["whsec_new", "whsec_old"]
    body = b'{"a":1}'
    timestamp = int(time.time())
    header = format_signature_header([
        compute_timestamped_signature(body, "whsec_new", timestamp),
        compute_timestamped_signature(body, "whsec_old", timestamp),
    ])
    assert verify_signature(body, header, timestamp, ["whsec_old"])
    assert verify_signature(body, header, timestamp, ["whsec_new"])


def test_expired_grace_window_drops_previous_secret():
    webhook = _fake_webhook(
        secret="whsec_new",
        previous_secret="whsec_old",
        secret_grace_expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
    )
    assert not webhook.previous_secret_usable()
    assert webhook.signing_secrets() == ["whsec_new"]


def test_naive_grace_timestamp_treated_as_utc():
    # Postgres returns aware datetimes, SQLite naive ones; both must work.
    naive_now = datetime.now(timezone.utc).replace(tzinfo=None)
    webhook = _fake_webhook(secret="s", previous_secret="p", secret_grace_expires_at=naive_now + timedelta(hours=1))
    assert webhook.previous_secret_usable()
    expired = _fake_webhook(secret="s", previous_secret="p", secret_grace_expires_at=naive_now - timedelta(hours=1))
    assert not expired.previous_secret_usable()


def test_webhook_without_previous_secret_is_not_usable():
    assert not _fake_webhook(secret="s", previous_secret=None).previous_secret_usable()
    assert not _fake_webhook(secret="s", previous_secret="p", secret_grace_expires_at=None).previous_secret_usable()


# ── Delivery path ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delivery_headers_carry_versioned_signature(monkeypatch):
    captured = {}

    class FakeResponse:
        status_code = 200
        text = "ok"

    async def fake_post(url, content=None, headers=None, timeout=None, follow_redirects=None):
        captured["content"] = content
        captured["headers"] = headers
        return FakeResponse()

    monkeypatch.setenv("WEBHOOK_ALLOW_HTTP", "true")
    monkeypatch.setenv("WEBHOOK_ALLOW_PRIVATE_IPS", "true")
    monkeypatch.setattr(webhook_engine, "get_client", lambda: type("C", (), {"post": staticmethod(fake_post)})())
    signing_out = {}
    status, _ = await webhook_engine.deliver_webhook(
        "http://127.0.0.1:9/hook",
        {"event": "test"},
        "test.event",
        uuid4(),
        uuid4(),
        secret=KNOWN_SECRET,
        signing_out=signing_out,
    )
    assert status == 200
    timestamp = int(captured["headers"]["X-Atlas-Timestamp"])
    assert captured["headers"]["X-Atlas-Signature"].startswith("v1=")
    assert verify_signature(captured["content"], captured["headers"]["X-Atlas-Signature"], timestamp, [KNOWN_SECRET])
    assert signing_out["request_body"] == captured["content"].decode()
    assert signing_out["signature_timestamp"] == timestamp
    assert signing_out["signature"] == captured["headers"]["X-Atlas-Signature"]
    # No legacy unversioned header is emitted any more.
    assert "X-Webhook-Signature" not in captured["headers"]


@pytest.mark.asyncio
async def test_delivery_during_grace_carries_both_signatures(monkeypatch):
    captured = {}

    class FakeResponse:
        status_code = 200
        text = "ok"

    async def fake_post(url, content=None, headers=None, timeout=None, follow_redirects=None):
        captured["content"] = content
        captured["headers"] = headers
        return FakeResponse()

    monkeypatch.setattr(webhook_engine, "get_client", lambda: type("C", (), {"post": staticmethod(fake_post)})())
    await webhook_engine.deliver_webhook(
        "http://127.0.0.1:9/hook",
        {"event": "test"},
        "test.event",
        uuid4(),
        uuid4(),
        secret="whsec_new",
        previous_secret="whsec_old",
    )
    header = captured["headers"]["X-Atlas-Signature"]
    assert parse_signature_header(header) == [
        compute_timestamped_signature(captured["content"], "whsec_new", int(captured["headers"]["X-Atlas-Timestamp"])),
        compute_timestamped_signature(captured["content"], "whsec_old", int(captured["headers"]["X-Atlas-Timestamp"])),
    ]
    assert "v1=" in header and header.count("v1=") == 2


@pytest.mark.asyncio
async def test_delivery_without_secret_is_unsigned(monkeypatch):
    captured = {}

    class FakeResponse:
        status_code = 200
        text = "ok"

    async def fake_post(url, content=None, headers=None, timeout=None, follow_redirects=None):
        captured["headers"] = headers
        return FakeResponse()

    monkeypatch.setattr(webhook_engine, "get_client", lambda: type("C", (), {"post": staticmethod(fake_post)})())
    await webhook_engine.deliver_webhook(
        "http://127.0.0.1:9/hook", {"event": "test"}, "test.event", uuid4(), uuid4(), secret=None
    )
    assert "X-Atlas-Signature" not in captured["headers"]
    assert "X-Atlas-Timestamp" not in captured["headers"]


class _CapturingHandler(BaseHTTPRequestHandler):
    last_headers = None
    last_body = None

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        type(self).last_body = self.rfile.read(length)
        type(self).last_headers = dict(self.headers.items())
        body = b"ok"
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class _DummyDb:
    def close(self):
        pass

    def execute(self, *args, **kwargs):
        class _Row:
            def fetchone(self):
                return (0, 3)

        return _Row()


def test_local_receiver_can_verify_and_sync_records_artifacts(monkeypatch):
    server = HTTPServer(("127.0.0.1", 0), _CapturingHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    deliveries = []
    try:
        monkeypatch.setenv("WEBHOOK_ALLOW_HTTP", "true")
        monkeypatch.setenv("WEBHOOK_ALLOW_PRIVATE_IPS", "true")
        monkeypatch.setattr(event_router, "get_db", lambda: _DummyDb())
        monkeypatch.setattr(event_router, "update_delivery_log", lambda db, log_id, data: deliveries.append(data))
        monkeypatch.setattr(event_router, "update_webhook", lambda *args, **kwargs: None)
        url = f"http://127.0.0.1:{server.server_port}/hook"
        event_router._deliver_sync(
            url, {"event": "test"}, "test.event", uuid4(), uuid4(), KNOWN_SECRET, {}, 10, "tenant-a"
        )
    finally:
        server.shutdown()

    assert deliveries[-1]["status"] == "DELIVERED"
    assert _CapturingHandler.last_headers["X-Atlas-Signature"].startswith("v1=")
    timestamp = int(_CapturingHandler.last_headers["X-Atlas-Timestamp"])
    assert verify_signature(_CapturingHandler.last_body, _CapturingHandler.last_headers["X-Atlas-Signature"], timestamp, [KNOWN_SECRET])
    assert deliveries[-1]["signature"] == _CapturingHandler.last_headers["X-Atlas-Signature"]
    assert deliveries[-1]["signature_timestamp"] == timestamp
    assert deliveries[-1]["request_body"] == _CapturingHandler.last_body.decode()


def test_tampered_body_from_a_local_receiver_replay_is_rejected():
    body = b'{"amount":"100.00"}'
    timestamp = int(time.time())
    header = format_signature_header([compute_timestamped_signature(body, KNOWN_SECRET, timestamp)])
    assert verify_signature(body, header, timestamp, [KNOWN_SECRET])
    assert not verify_signature(b'{"amount":"100.01"}', header, timestamp, [KNOWN_SECRET])


# ── Secret lifecycle ──────────────────────────────────────────────


class _FakeDb:
    def __init__(self, result=None):
        self.result = result
        self.committed = False
        self.added = []

    def query(self, model):
        result = self.result

        class _Query:
            def filter(self, *args, **kwargs):
                return self

            def first(self):
                return result

        return _Query()

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.committed = True

    def refresh(self, obj):
        pass


def test_create_webhook_generates_secret(monkeypatch):
    monkeypatch.setattr("crud.validate_webhook_url", lambda url: url)
    db = _FakeDb()
    webhook = create_webhook(db, "tenant-a", {"name": "n", "url": "https://example.com/hook", "event_types": []})
    assert webhook.secret.startswith("whsec_")
    assert len(webhook.secret) > 20
    assert db.committed


def test_create_webhook_keeps_caller_supplied_secret(monkeypatch):
    monkeypatch.setattr("crud.validate_webhook_url", lambda url: url)
    db = _FakeDb()
    webhook = create_webhook(
        db, "tenant-a", {"name": "n", "url": "https://example.com/hook", "secret": "whsec_manual"}
    )
    assert webhook.secret == "whsec_manual"


def test_rotate_webhook_secret_opens_grace_window(monkeypatch):
    monkeypatch.setattr("crud.validate_webhook_url", lambda url: url)
    webhook = _fake_webhook(secret="whsec_old", previous_secret=None)
    db = _FakeDb(result=webhook)
    rotated, new_secret = rotate_webhook_secret(db, webhook.id, "tenant-a", grace_seconds=3600)
    assert rotated is webhook
    assert new_secret.startswith("whsec_")
    assert new_secret != "whsec_old"
    assert webhook.secret == new_secret
    assert webhook.previous_secret == "whsec_old"
    assert webhook.previous_secret_usable()
    assert webhook.previous_secret_valid_until is not None
    remaining = webhook.previous_secret_valid_until - datetime.now(timezone.utc)
    assert timedelta(minutes=55) < remaining <= timedelta(hours=1, seconds=5)


def test_rotate_webhook_secret_404_for_unknown_webhook():
    assert rotate_webhook_secret(_FakeDb(result=None), uuid4(), "tenant-a") is None


def test_rotate_enables_signing_for_webhook_without_secret(monkeypatch):
    webhook = _fake_webhook(secret=None, previous_secret=None)
    db = _FakeDb(result=webhook)
    rotated, new_secret = rotate_webhook_secret(db, webhook.id, "tenant-a")
    assert rotated.secret == new_secret
    assert rotated.previous_secret is None
    assert rotated.secret_grace_expires_at is None


def test_update_allowlist_rejects_direct_secret_swap():
    assert "secret" not in WEBHOOK_UPDATE_FIELDS
    with pytest.raises(MassAssignmentError):
        apply_updates(_fake_webhook(), {"secret": "whsec_sneaky"}, WEBHOOK_UPDATE_FIELDS)


# ── Delivery detail artifacts ─────────────────────────────────────


def test_build_delivery_detail_returns_exact_signed_payload():
    webhook = _fake_webhook(url="https://example.com/hook")
    body = '{"event":"test"}'
    log = _fake_delivery_log(
        webhook_id=webhook.id,
        signature="v1=deadbeef",
        signature_timestamp=1700000000,
        request_body=body,
    )
    detail = build_delivery_detail(_FakeDb(result=webhook), log)
    assert detail["signed_payload"] == body
    assert detail["body_reconstructed"] is False
    assert detail["signature"] == "v1=deadbeef"
    assert detail["signature_timestamp"] == 1700000000
    assert detail["signature_version"] == "v1"
    assert "curl -X POST" in detail["curl_example"]
    assert "X-Atlas-Timestamp: 1700000000" in detail["curl_example"]
    assert "X-Atlas-Signature: v1=deadbeef" in detail["curl_example"]


def test_build_delivery_detail_reconstructs_legacy_logs():
    webhook = _fake_webhook()
    log = _fake_delivery_log(webhook_id=webhook.id, payload={"event": "legacy"}, request_body=None, signature=None)
    detail = build_delivery_detail(_FakeDb(result=webhook), log)
    assert detail["body_reconstructed"] is True
    assert json.loads(detail["signed_payload"]) == {"event": "legacy"}
    assert detail["curl_example"] is None


def test_build_curl_example_escapes_single_quotes():
    snippet = build_curl_example("https://example.com/hook", 1700000000, "v1=abc", "{\"note\":\"it's fine\"}")
    assert "it'\\''s fine" in snippet


# ── HTTP endpoints ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_endpoint_shows_secret_once(monkeypatch):
    import main

    webhook = _fake_webhook(secret="whsec_shown_once")
    monkeypatch.setattr(main, "create_webhook", lambda db, tenant_id, data: webhook)
    transport = ASGITransport(app=main.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/integration/webhooks",
            headers={"x-internal-auth": _mint_internal_token()},
            json={"name": "billing-hook", "url": "https://example.com/hook", "event_types": []},
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["secret"] == "whsec_shown_once"
    assert data["secret_shown_once"] is True
    assert data["secret_set"] is True


@pytest.mark.asyncio
async def test_get_or_list_never_returns_secret_material(monkeypatch):
    import main

    webhook = _fake_webhook(secret="whsec_hidden", previous_secret="whsec_older_hidden")
    monkeypatch.setattr(main, "get_webhook", lambda db, webhook_id, tenant_id: webhook)
    monkeypatch.setattr(
        main, "list_webhooks",
        lambda db, tenant_id, page=1, page_size=20, enabled=None: {
            "items": [webhook], "total": 1, "page": 1, "page_size": 20,
        },
    )
    transport = ASGITransport(app=main.app)
    headers = {"x-internal-auth": _mint_internal_token()}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        get_resp = await client.get(f"/api/v1/integration/webhooks/{webhook.id}", headers=headers)
        list_resp = await client.get("/api/v1/integration/webhooks", headers=headers)
    assert get_resp.status_code == 200
    assert "secret" not in get_resp.json()
    assert "whsec_hidden" not in json.dumps(get_resp.json())
    assert list_resp.status_code == 200
    assert "whsec_hidden" not in json.dumps(list_resp.json())
    assert "whsec_older_hidden" not in json.dumps(list_resp.json())
    assert list_resp.json()["items"][0]["secret_set"] is True


@pytest.mark.asyncio
async def test_rotate_endpoint_returns_secret_and_grace_expiry(monkeypatch):
    import main

    grace_until = datetime.now(timezone.utc) + timedelta(hours=24)
    webhook = _fake_webhook(secret="whsec_new", previous_secret="whsec_old", secret_grace_expires_at=grace_until)
    monkeypatch.setattr(main, "rotate_webhook_secret", lambda db, webhook_id, tenant_id, grace_seconds: (webhook, "whsec_new"))
    transport = ASGITransport(app=main.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/integration/webhooks/{webhook.id}/rotate-secret",
            headers={"x-internal-auth": _mint_internal_token()},
            params={"grace_seconds": 3600},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["secret"] == "whsec_new"
    assert data["secret_shown_once"] is True
    assert data["signature_version"] == "v1"
    assert data["previous_secret_valid_until"] is not None


@pytest.mark.asyncio
async def test_rotate_endpoint_404_for_other_tenant(monkeypatch):
    import main

    monkeypatch.setattr(main, "rotate_webhook_secret", lambda db, webhook_id, tenant_id, grace_seconds: None)
    transport = ASGITransport(app=main.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/integration/webhooks/{uuid4()}/rotate-secret",
            headers={"x-internal-auth": _mint_internal_token()},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delivery_detail_endpoint_returns_curl_example(monkeypatch):
    import main

    webhook_id = uuid4()
    webhook = _fake_webhook(id=webhook_id, url="https://example.com/hook")
    log = _fake_delivery_log(
        webhook_id=webhook_id,
        signature="v1=deadbeef",
        signature_timestamp=1700000000,
        request_body='{"event":"test"}',
    )
    monkeypatch.setattr(main, "get_delivery_log", lambda db, delivery_id, tenant_id: log)
    monkeypatch.setattr(main, "build_delivery_detail", lambda db, log: {
        "id": log.id,
        "webhook_id": log.webhook_id,
        "tenant_id": log.tenant_id,
        "event_type": log.event_type,
        "status": log.status,
        "status_code": log.status_code,
        "response_body": log.response_body,
        "attempts": log.attempts,
        "max_attempts": log.max_attempts,
        "next_retry_at": log.next_retry_at,
        "delivered_at": log.delivered_at,
        "created_at": log.created_at,
        "payload": log.payload,
        "signature": log.signature,
        "signature_timestamp": log.signature_timestamp,
        "signed_payload": log.request_body,
        "body_reconstructed": False,
        "target_url": webhook.url,
        "curl_example": build_curl_example(webhook.url, log.signature_timestamp, log.signature, log.request_body),
    })
    transport = ASGITransport(app=main.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            f"/api/v1/integration/webhooks/{webhook_id}/deliveries/{log.id}",
            headers={"x-internal-auth": _mint_internal_token()},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["signed_payload"] == '{"event":"test"}'
    assert data["signature"] == "v1=deadbeef"
    assert "curl -X POST" in data["curl_example"]


@pytest.mark.asyncio
async def test_delivery_detail_endpoint_404_for_mismatched_webhook(monkeypatch):
    import main

    log = _fake_delivery_log(webhook_id=uuid4())
    monkeypatch.setattr(main, "get_delivery_log", lambda db, delivery_id, tenant_id: log)
    transport = ASGITransport(app=main.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            f"/api/v1/integration/webhooks/{uuid4()}/deliveries/{log.id}",
            headers={"x-internal-auth": _mint_internal_token()},
        )
    assert resp.status_code == 404
