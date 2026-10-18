# Integration Service

Enterprise integration hub for the Atlas Workforce Intelligence Platform:
webhook delivery with retry/backoff and SSRF guards, Kafka event bridge,
RabbitMQ consumer, and an event outbox.

Port: 8016. All routes except `/health` and `/metrics` require the internal
service JWT (`x-internal-auth`), and the tenant is bound from the verified
claims.

## Webhook signing

Every webhook endpoint has a signing secret. The secret is generated when the
endpoint is created and is returned exactly once, in the `201` response body
of `POST /api/v1/integration/webhooks` (`secret` field, plus
`secret_shown_once: true`). List and get responses never echo secret material;
they only expose `secret_set`, `secret_rotated_at`, and
`previous_secret_valid_until`.

Each delivery carries:

| Header | Value |
| --- | --- |
| `X-Atlas-Timestamp` | Unix seconds used at signing time |
| `X-Atlas-Signature` | `v1=<hex hmac>` (space-separated entries during a rotation grace window, newest first) |

The signature is `HMAC-SHA256(secret, "<timestamp>.<raw request body>")`,
hex-encoded. `v1` is the signature version; add a new version rather than
changing `v1`.

Recommended receiver checks:

1. Read the raw request body bytes before any framework parses/re-serializes
   them.
2. Reject when `abs(now - X-Atlas-Timestamp) > 300` seconds (replay window).
3. Compute the HMAC over `timestamp + "." + body` with the endpoint secret.
4. Accept when it matches any `v1=` entry in `X-Atlas-Signature`
   (`hmac.compare_digest`, constant time). During a rotation two entries are
   present and either may match.

### Verify in Node

```js
const crypto = require("crypto");

function verifyAtlasWebhook(rawBody, headers, secret, toleranceSec = 300) {
  const timestamp = headers["x-atlas-timestamp"];
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSec) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const provided = (headers["x-atlas-signature"] || "")
    .split(/[\s,]+/)
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));
  return provided.some((sig) =>
    crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"))
  );
}
```

### Verify in Python

```python
import hashlib
import hmac
import time

def verify_atlas_webhook(raw_body: bytes, headers: dict, secret: str, tolerance_sec: int = 300) -> bool:
    timestamp = headers.get("x-atlas-timestamp")
    if not timestamp or abs(time.time() - int(timestamp)) > tolerance_sec:
        return False
    expected = hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()
    provided = [
        part[3:]
        for part in headers.get("x-atlas-signature", "").replace(",", " ").split()
        if part.startswith("v1=")
    ]
    return any(hmac.compare_digest(expected, sig) for sig in provided)
```

### Rotate a secret

`POST /api/v1/integration/webhooks/{id}/rotate-secret?grace_seconds=86400`
(default grace: 24h, configurable with the
`WEBHOOK_SECRET_ROTATION_GRACE_SEC` environment variable). The response
returns the new secret once and the timestamp until which the previous secret
still produces a valid signature.
During that window deliveries list both signatures, so a receiver can move
from old to new without dropping deliveries. After the window only the new
secret is used. Directly setting `secret` through `PUT` is rejected on
purpose; rotate via this endpoint so the overlap is recorded.

### Inspect a delivery

`GET /api/v1/integration/webhooks/{webhook_id}/deliveries/{delivery_id}`
returns the delivery status plus the exact bytes and signature headers that
were signed (`signed_payload`, `signature`, `signature_timestamp`), and a
copy-paste `curl_example` that replays the request against the endpoint so a
receiver can debug its own verifier. For deliveries recorded before signing
artifacts were stored, `body_reconstructed` is `true` and the payload is
re-serialized from the stored event.

## Tests

```bash
cd services/integration-service
python -m pytest -v
```

Local runs of the delivery tests that bind a loopback receiver need
`WEBHOOK_ALLOW_HTTP=true` and `WEBHOOK_ALLOW_PRIVATE_IPS=true` (CI sets both).
