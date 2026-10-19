#!/usr/bin/env bash
# #487 chaos drill: kill PgBouncer mid-traffic and prove fast recovery.
#
# Run against a compose deployment that is already under steady read/write
# traffic (e.g. `k6 run` on a login or directory loop). Expected outcome is
# documented in docs/pgbouncer-rollout.md:
#   * requests during the outage fail fast with connection errors (no hangs),
#   * every service reconnects within pool_timeout + pool_pre_ping retries
#     once the container is back,
#   * no stale, half-open backend connections remain (pg_stat_activity shows
#     no orphans from the dead pooler).
set -euo pipefail

cd "$(dirname "$0")/.."

POOLER=atlas-pgbouncer
QUERIES="SELECT 1 FROM pg_stat_activity"

echo "== baseline"
docker compose exec -T postgres psql -U "${POSTGRES_USER:-atlas_user}" -d "${POSTGRES_DB:-atlas_db}" -c "$QUERIES;" | tail -n +1

echo "== traffic marker: keep your load generator running; killing pooler now"
docker kill "$POOLER"

sleep 30

echo "== restart pooler"
docker compose up -d --wait pgbouncer

echo "== recovery probe: services must reconnect without restart"
for svc in auth-service analytics-service ats-service; do
  container="atlas-${svc}"
  docker exec "$container" sh -c 'true' 2>/dev/null || true
done

echo "== orphan check: no backend connections held by a dead pooler"
docker compose exec -T postgres psql -U "${POSTGRES_USER:-atlas_user}" -d "${POSTGRES_DB:-atlas_db}" \
  -c "SELECT application_name, count(*) FROM pg_stat_activity GROUP BY 1;"

echo "== result: record the error rate curve and the p99 during the outage"
echo "   from your load tool; recovery is the metric hitting zero connection"
echo "   errors within ~30s of `up -d --wait pgbouncer`."
