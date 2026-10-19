# Redis outage and durability posture

Redis is the shared auth store behind rate limiting, session/token denylists,
and MFA replay protection. Its loss must be a loud, documented degradation, not
a silent reset of security state. This matrix is the reviewed fail-open and
fail-closed decision for every consumer; any new consumer needs a row here.

## Persistence configuration (compose and k8s)

Both the compose service and the k8s StatefulSet run with AOF `everysec` plus
RDB checkpoints (`--save 300 10`, `--save 60 1000`) and
`--maxmemory-policy noeviction`. The k8s workload is a StatefulSet backed by a
PVC, so denylist and rate-limit state survive pod restarts and worker
rescheduling up to at most one second of acknowledged writes (AOF `everysec`).

No key is evicted under memory pressure (`noeviction`): evicting a security key
silently converts into policy (a revoked token becomes valid again). If memory
runs out, writes fail loudly and request cells below degrade to their
documented fail-closed posture. Caches that may safely drop entries live under
gateway in-memory paths instead of this instance.

## Outage matrix

| Consumer | Store usage | On Redis loss / restart | Degradation signal |
|---|---|---|---|
| api-gateway-node token denylist | `denylist:jti:*`, `denylist:sid:*` reads at JWT verification | Fail-closed: requests are refused 503, never admitted without a confirmed denylist check | `atlas_gateway_redis_degraded_total{check="token_denylist"}` |
| api-gateway-node MFA step-up replay | `mfa_jti:*` consume-on-first-use (SET NX + EX) | Fail-closed: step-up requests refused 503 during the outage | `atlas_gateway_redis_degraded_total{check="mfa_replay"}` |
| api-gateway-node rate limiters | `rl:global:`, `rl:auth:`, `rl:login:`, `rl:api:`, `rl:sensitive:`, `rl:career:*`, `rl:scim:`, `rl:saml:` stores | Per-path 429 budgets hold because the store is the limiter; if the store fails-down hard the limiter errors visibly rather than silently exempting traffic. A restart no longer resets live counting because state persists via AOF | 429/5xx rates on limiter paths |
| api-gateway-node response cache | short-lived `sweep:*` cache entries | Fail-open and safe: a cache miss only costs latency, never security | `X-Cache` header behavior |
| api-gateway-node audit retry queue | audit payload queues drained to the audit service | Queues persist through restart (AOF); metrics `atlas_audit_*` still report queue depths | `atlas_audit_retry_queue_depth` |
| auth-service MFA challenge jti store | `mfa_challenge:*` single-use challenge tokens | Fail-closed: challenge token cannot be issued, checked, or consumed, so login/validate refuse 503 and the challenge cannot be replayed | `atlas_auth_redis_degraded_total{check="mfa_challenge_store\|mfa_challenge_check\|mfa_challenge_consume"}` |
| auth-service logout denylist write | `denylist:jti/*`, `denylist:sid:*` on logout | Fail-closed: logout refuses 503 with cookies intact, client retries after recovery | `atlas_auth_redis_degraded_total{check="logout_denylist"}` |
| auth-service session revocation | denylist writes on `DELETE /sessions/:id` and `DELETE /sessions` | Fail-closed: revocation refuses 503 instead of returning success while tokens stay usable at the gateway | `atlas_auth_redis_degraded_total{check="session_revoke_denylist\|session_revoke_all_denylist"}` |
| auth-service device nonce check | `device_nonce:*` reuse guard | Fail-closed: nonce verification unavailable returns 503 | 503 on `/devices/verify` |
| auth-service distributed rate limits | `rl:*` Lua INCR + PEXPIRE across replicas | Multi-replica in-process fallback windows are per-replica during an outage; the global limiter still applies. Documented as fail-open with reduced fidelity, refreshed 15-minute windows | rate-limit response headers |
| auth-service in-process fallback limiters | memory map | Unchanged behavior; per-replica only | n/a |

## Recovery contract

- A Redis restart does not lift rate limits or validate logged-out tokens:
  denylist and limiter state recover from the AOF; gaps are bounded by
  `everysec` fsync.
- Any request that was refused because the store was down returns 503 with a
  retryable envelope (code `auth_store_unavailable`), so degraded mode always
  looks like an explicit refusal, never a quiet pass.
- The degraded counters expose every fail-closed refusal for alerting.

## Failover story

The k8s StatefulSet runs a single persisted replica. Running Redis in sentinel
(or a managed HA Redis) is a planned follow-up; until then, a pod-level outage
is a deliberate visible degradation per the matrix above, not a security
window: every consumer either has durable state after the restart or fails
closed while it is down.
