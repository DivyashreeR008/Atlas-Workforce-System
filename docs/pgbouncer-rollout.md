# PgBouncer rollout + connection-pool audit (#487)

Layered with #478 (statement timeouts and explicit pool sizing in code,
already wired for analytics + auth on that slice). This slice makes the
connection layer real: a PgBouncer with transaction pooling in front of
Postgres in compose and k8s, every service routed through it, pool sizing
in code for the remaining Python Postgres services, and the chaos proof
scripted rather than aspirational.

## What landed here

### 1. Pool sizing in code (all Python Postgres services)

`atlas_observability.db_pool_config.engine_kwargs` (brought in from the
#478 slice, where analytics already uses it) is now applied at engine
construction in **ats, audit-compliance, employee-lifecycle,
integration, security and workforce-planning** as well, each with a
service-prefixed env override so sizes can be tuned independently
(`ATS_DATABASE_POOL_SIZE`, `INTEGRATION_DATABASE_MAX_OVERFLOW`, ...).
Defaults: pool_size 5, max_overflow 10, recycle 1800s, pool_timeout 10s,
statement_timeout 15000ms (PostgreSQL URLs only; SQLite harnesses are
excluded). Sizes are fixed numbers instead of SQLAlchemy library
defaults so `(pool_size + max_overflow) * replicas` is an auditable
number against Postgres `max_connections` - the sizing is deliberate
conservatism (5/10 covers each service's FastAPI threadpool concurrency
with headroom); "measured concurrency" sizing is the follow-up once the
slow-query/dashboard metrics of #456 have produced real numbers.

### 2. PgBouncer, transaction pooling

- `docker-compose.yml`: new `pgbouncer` service
  (`edoburu/pgbouncer:1.24.0-p1`, health-gated on postgres), pooled per
  the documented knobs: `POOL_MODE=transaction`,
  `MAX_CLIENT_CONN=400`, `DEFAULT_POOL_SIZE=20`, `MIN_POOL_SIZE=5`,
  `RESERVE_POOL_SIZE=5`, `MAX_DB_CONNECTIONS=100`,
  `MAX_PREPARED_STATEMENTS=200`, `QUERY_TIMEOUT=300s`,
  `IDLE_TRANSACTION_TIMEOUT=120s`.
- **Every compose service with a Postgres connection now connects through
  `pgbouncer:6432`**: DATABASE_URL / POSTGRES_URL / pgx DSN /
  SPRING_DATASOURCE_URL / DB_HOST+DB_PORT were all repointed (verified by
  `grep postgres` on the compose file: only the primary's own
  definition, healthcheck and its host port publish remain). The replica
  work in #488 composes with this: a replica entry would be another
  `[databases]` alias behind the same pooler.
- `k8s/pgbouncer.yaml`: 2-replica Deployment + Service for the prod
  shape; `k8s/configmap.yaml` points `DB_HOST`/`DB_PORT` and the Spring
  datasource at the `pgbouncer` Service.
- Transaction pooling compat: PgBouncer >= 1.21 supports protocol-level
  prepared statements (`max_prepared_statements=200` set here), which is
  what pgx, pgjdbc and Hibernate need; session state that transaction
  mode cannot carry (SETs, temp tables) is not used by the Python
  services (the `sql_slow_query` listener is client-side timing only).

### 3. Chaos proof: kill the pooler mid-traffic

`scripts/chaos_kill_pgbouncer.sh` runs the drill: baseline
`pg_stat_activity` snapshot, `docker kill atlas-pgbouncer` under steady
load, 30s outage, restart with `up -d --wait`, then a second snapshot
that must show no orphaned backend connections and a reconnect without
restarting any service. The degradation shape the code guarantees:
during the outage callers fail fast (connect timeout 5s server-side,
`pool_timeout` 10s client-side), and `pool_pre_ping` plus SQLAlchemy's
pool reconnect logic re-establishes sessions on the restarted pooler.
Not executed in this environment (no Docker daemon) - the script is the
rehearsable artifact, run in CI/staging for the acceptance evidence.

### 4. What was *not* done yet (explicit)

- The per-service pool-wait / active-connections dashboard: the client
  side emits `atlas_db_pool_exhausted_total` (from #478, guarded here via
  the shared module) and PgBouncer exposes the `pgbouncer_*` stats
  (`SHOW POOLS`, `SHOW STATS`) via its admin console; wiring both into
  `grafana/` panels belongs with the dashboard follow-up of #456 so one
  panel row covers pool wait time, active connections and timeout
  cancellations per service.
- k8s chaos drill automation (kill pgbouncer pod mid-traffic): same
  script shape, needs a running cluster.

## Verification

- Unit tests for the shared config/guard:
  `services/atlas_observability/test_db_pool_config.py` (7 tests) -
  bounded defaults, prefixed env overrides, invalid-value fallback,
  PostgreSQL-only connect_args, the 503 + metric pool-exhaustion path.
- `python -m py_compile` clean on the six service main.py files.
- `docker-compose.yml` parses as YAML; the pgbouncer service has no
  self-dependency and every Postgres-backed service depends on it with
  `service_healthy`.
- `k8s/pgbouncer.yaml` and `k8s/configmap.yaml` are valid YAML; the
  configmap comment states the layering (postgres name reserved for
  primary/admin).
- Service suites: CI re-runs them with the pool config baked in
  (`pool_pre_ping` + bounded pool only change behavior under
  saturation).

## Rollout note

Deploy order matters: pgbouncer first (idle until services switch), then
the service envs. Rollback is a compose revert (envs point back at
`postgres:5432`); the pooler holds no data.
