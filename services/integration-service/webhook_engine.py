import asyncio
import hmac
import hashlib
import json
import logging
import os
import secrets
import threading
import time
from datetime import datetime, timezone
from typing import Dict, Optional
from uuid import UUID

import httpx

try:
    from prometheus_client import Counter as _PromCounter
except Exception:
    _PromCounter = None
from ssrf_guard import MAX_RESPONSE_BODY_CHARS, SSRFBlockedError, validate_webhook_headers, validate_webhook_url

logger = logging.getLogger("webhook-engine")

INTERNAL_JWT_SECRET = os.environ.get("INTERNAL_JWT_SECRET", "")
AUDIT_SERVICE_URL = os.environ.get("AUDIT_SERVICE_URL", "http://audit-compliance-service:8011")
AUDIT_WRITER_AUDIENCE = "audit-writer"

if _PromCounter is not None:
    try:
        AUDIT_DELIVERY_FAILURES = _PromCounter(
            "atlas_audit_delivery_failures_total",
            "Total audit log delivery failures from integration-service",
            ["event_type"],
        )
    except Exception:
        AUDIT_DELIVERY_FAILURES = None
else:
    AUDIT_DELIVERY_FAILURES = None

# httpx.AsyncClient pools hold primitives bound to the loop that first used
# them, so one global client cannot be shared across the per-delivery loops
# created in event_router. Keep one client per running loop instead.
_clients: Dict[int, httpx.AsyncClient] = {}
_clients_lock = threading.Lock()


def _loop_key() -> Optional[int]:
    try:
        return id(asyncio.get_running_loop())
    except RuntimeError:
        return None


def get_client() -> httpx.AsyncClient:
    key = _loop_key()
    with _clients_lock:
        client = _clients.get(key)
        if client is None or client.is_closed:
            client = httpx.AsyncClient(timeout=30.0, limits=httpx.Limits(max_keepalive_connections=50, max_connections=100))
            _clients[key] = client
        return client


SIGNATURE_VERSION = "v1"
SIGNATURE_HEADER = "X-Atlas-Signature"
TIMESTAMP_HEADER = "X-Atlas-Timestamp"
# Receivers reject deliveries whose timestamp is outside this window, which
# makes a captured payload useless for replay once the window passes.
DEFAULT_TOLERANCE_SEC = 300


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


# How long the previous secret keeps producing a valid signature after a
# rotation. Operators can shorten or extend it per rotation call.
DEFAULT_ROTATION_GRACE_SEC = _env_int("WEBHOOK_SECRET_ROTATION_GRACE_SEC", 24 * 3600)


def generate_webhook_secret() -> str:
    return "whsec_" + secrets.token_urlsafe(32)


def compute_signature(payload: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def signed_content(timestamp: int, body: bytes) -> bytes:
    return str(int(timestamp)).encode("utf-8") + b"." + body


def compute_timestamped_signature(body: bytes, secret: str, timestamp: int) -> str:
    return compute_signature(signed_content(timestamp, body), secret)


def format_signature_header(signatures: list[str]) -> str:
    # During a rotation grace window the header lists one entry per active
    # secret, newest first; receivers accept the request when any entry
    # matches (same convention as Stripe's multi-signature header).
    return " ".join(f"{SIGNATURE_VERSION}={signature}" for signature in signatures)


def parse_signature_header(header: Optional[str]) -> list[str]:
    if not header:
        return []
    entries = []
    for part in header.replace(",", " ").split():
        if part.startswith(f"{SIGNATURE_VERSION}="):
            entries.append(part.split("=", 1)[1])
    return entries


def is_timestamp_fresh(timestamp, tolerance_sec: int = DEFAULT_TOLERANCE_SEC, now: Optional[int] = None) -> bool:
    try:
        sent_at = int(timestamp)
    except (TypeError, ValueError):
        return False
    current = int(time.time()) if now is None else int(now)
    return abs(current - sent_at) <= int(tolerance_sec)


def verify_signature(
    body: bytes,
    signature_header: Optional[str],
    timestamp,
    secrets_list: list[str],
    tolerance_sec: int = DEFAULT_TOLERANCE_SEC,
    now: Optional[int] = None,
) -> bool:
    """Verify an X-Atlas-Signature header over timestamp.body.

    Mirrors the documented receiver-side check: reject stale timestamps, then
    accept the delivery when any advertised signature matches any of the
    secrets the receiver holds (current plus, during rotation, previous).
    """
    if not is_timestamp_fresh(timestamp, tolerance_sec, now):
        return False
    provided = parse_signature_header(signature_header)
    if not provided:
        return False
    for secret in secrets_list:
        if not secret:
            continue
        expected = compute_timestamped_signature(body, secret, int(timestamp))
        for candidate in provided:
            if hmac.compare_digest(expected, candidate):
                return True
    return False


def build_curl_example(url: str, timestamp: int, signature_header: str, body: str) -> str:
    """Copy-paste curl that replays a delivery for receiver-side debugging."""

    def single_quote(value: str) -> str:
        return "'" + str(value).replace("'", "'\\''") + "'"

    return (
        f"curl -X POST {single_quote(url)} \\\n"
        f"  -H 'Content-Type: application/json' \\\n"
        f"  -H {single_quote(f'{TIMESTAMP_HEADER}: {timestamp}')} \\\n"
        f"  -H {single_quote(f'{SIGNATURE_HEADER}: {signature_header}')} \\\n"
        f"  --data-raw {single_quote(body)}"
    )


def _base64url_no_pad(raw: bytes) -> str:
    import base64

    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def mint_audit_writer_token() -> str:
    if not INTERNAL_JWT_SECRET:
        raise RuntimeError("INTERNAL_JWT_SECRET is required to send audit events")
    header_b64 = _base64url_no_pad(json.dumps({"alg": "HS256"}).encode())
    payload_b64 = _base64url_no_pad(
        json.dumps(
            {
                "sub": "integration-service",
                "service": "integration-service",
                "tenant_id": "default",
                "aud": AUDIT_WRITER_AUDIENCE,
                "exp": int(time.time()) + 60,
            }
        ).encode()
    )
    signing_input = f"{header_b64}.{payload_b64}"
    signature = _base64url_no_pad(
        hmac.new(INTERNAL_JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
    )
    return f"{signing_input}.{signature}"


def serialize_payload(payload: dict) -> bytes:
    return json.dumps(payload, default=str).encode("utf-8")


async def deliver_webhook(
    url: str,
    payload: dict,
    event_type: str,
    webhook_id: UUID,
    delivery_log_id: UUID,
    secret: Optional[str] = None,
    custom_headers: Optional[dict[str, str]] = None,
    timeout_sec: int = 30,
    previous_secret: Optional[str] = None,
    signing_out: Optional[dict] = None,
) -> tuple[int, Optional[str]]:
    try:
        validate_webhook_url(url)
    except SSRFBlockedError as e:
        logger.warning(f"Blocked webhook delivery to disallowed destination: {e}")
        return 0, f"Blocked destination: {e}"

    try:
        safe_headers = validate_webhook_headers(custom_headers)
    except SSRFBlockedError as e:
        logger.warning(f"Blocked webhook delivery with disallowed headers: {e}")
        return 0, f"Blocked headers: {e}"

    client = get_client()
    body = serialize_payload(payload)
    timestamp = int(time.time())

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Event": event_type,
        "X-Webhook-ID": str(webhook_id),
        "X-Delivery-ID": str(delivery_log_id),
    }
    signatures = []
    if secret:
        signatures.append(compute_timestamped_signature(body, secret, timestamp))
        if previous_secret:
            signatures.append(compute_timestamped_signature(body, previous_secret, timestamp))
    if signatures:
        headers[TIMESTAMP_HEADER] = str(timestamp)
        headers[SIGNATURE_HEADER] = format_signature_header(signatures)
        if signing_out is not None:
            # Artifacts for the delivery-detail view: the exact bytes and
            # headers this attempt signed, never the secret itself.
            signing_out.update({
                "signature": headers[SIGNATURE_HEADER],
                "signature_timestamp": timestamp,
                "request_body": body.decode("utf-8", errors="replace"),
            })
    if safe_headers:
        headers.update(safe_headers)

    try:
        response = await client.post(url, content=body, headers=headers, timeout=timeout_sec, follow_redirects=False)
        if response.status_code in (301, 302, 303, 307, 308):
            return response.status_code, "Redirects are not followed for webhook deliveries"
        return response.status_code, response.text[:MAX_RESPONSE_BODY_CHARS]
    except httpx.TimeoutException:
        return 408, "Request timed out"
    except httpx.RequestError as e:
        return 0, str(e)


async def send_audit_event(event_type: str, details: dict):
    try:
        token = mint_audit_writer_token()
    except RuntimeError as e:
        logger.warning(f"Skipping audit event, service not configured: {e}")
        return
    delays = [0, 0.3]
    for attempt, delay in enumerate(delays):
        if delay:
            await asyncio.sleep(delay)
        try:
            client = get_client()
            await client.post(
                f"{AUDIT_SERVICE_URL}/api/v1/audit/log",
                json={
                    "event_type": event_type,
                    "user_id": "system",
                    "email": "system@integration-service",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "details": details,
                    "service": "integration-service",
                },
                headers={"x-internal-auth": token},
                timeout=3.0,
            )
            return
        except Exception as e:
            if attempt == len(delays) - 1:
                if AUDIT_DELIVERY_FAILURES is not None:
                    try:
                        AUDIT_DELIVERY_FAILURES.labels(event_type=event_type).inc()
                    except Exception:
                        pass
                logger.warning(f"Failed to send audit event: {e}")


async def close_client():
    key = _loop_key()
    with _clients_lock:
        client = _clients.pop(key, None)
    if client is not None and not client.is_closed:
        await client.aclose()


async def close_all_clients():
    with _clients_lock:
        clients = list(_clients.values())
        _clients.clear()
    for client in clients:
        if not client.is_closed:
            try:
                await client.aclose()
            except Exception as e:
                logger.warning(f"Failed to close webhook client: {e}")
