# Database pool policy and statement timeouts (#478)

Runaway queries and unbounded pool queueing are the two ways a single
heavy request degrades a shared Postgres for every service. The policy
here bounds both, per service, with explicit numbers instead of library
defaults, so the database connection budget of a deployment is knowable.

## The policy

| knob | default | meaning |
|---|---|---|
| statement timeout | 15000 ms | Postgres cancels any statement running longer; the caller gets an error, not a hung connection |
| pool size | 5 (Python) / 10 (auth) | steady-state connections per process |
| max overflow | 10 (Python) | burst connections above pool size |
| pool timeout | 10 s | checkout wait before the request fails fast |
| connection timeout | 5000 ms (auth) | new-connection establishment budget |
| pool recycle | 1800 s | connections are recycled to avoid stale-server drift |

Sizing rule of thumb: `pool_size` covers a service's steady DB-using
concurrency, targeting roughly <= 70% utilization; `max_overflow` is the
burst headroom. Do not raise either without adding the process count up
(`(pool_size + max_overflow) * replicas`) against Postgres's
`max_connections`.

## Python services (SQLAlchemy)

`atlas_observability.db_pool_config.engine_kwargs(database_url, prefix)`
produces the `create_engine` kwargs: bounded pool, `pool_pre_ping`,
`pool_timeout`, and - for PostgreSQL URLs only (SQLite harnesses must not
receive server-only options) - `connect_args={"options": "-c
statement_timeout=<ms>"}`. Environment overrides are
`DATABASE_STATEMENT_TIMEOUT_MS`, `DATABASE_POOL_SIZE`,
`DATABASE_MAX_OVERFLOW`, `DATABASE_POOL_RECYCLE_SECONDS`,
`DATABASE_POOL_TIMEOUT_SECONDS`, optionally prefixed per service (e.g.
`ANALYTICS_DATABASE_POOL_SIZE`). Invalid values fall back to the default
with a warning instead of breaking engine construction.

`install_pool_guard(app, service_name)` maps the pool checkout timeout
(`sqlalchemy.exc.TimeoutError`) to an immediate `503` with `Retry-After:
5` and increments `atlas_db_pool_exhausted_total{service}`. A saturated
pool is therefore a visible, retryable signal - not a wall of 500s with
requests silently stacking in queue.

Applied in this slice to the analytics service (the highest runaway-query
risk: unbounded date ranges, raw SQL aggregations). Other Python services
adopt the same two lines (import + `engine_kwargs` + guard) in a
follow-up, after the sizing defaults have soak time here.

## Auth service (node-postgres)

The `pg` `Pool` gets explicit budgets via `.env.example`-documented
variables: `PG_POOL_MAX` (10), `PG_IDLE_TIMEOUT_MS` (30s),
`PG_CONNECT_TIMEOUT_MS` (5s), `PG_STATEMENT_TIMEOUT_MS` (15s) and
`PG_QUERY_TIMEOUT_MS` (15s). `statement_timeout` is passed per client by
node-postgres into the connection startup, so it applies to every query
the pool issues. Pool connection errors are counted in
`atlas_auth_db_pressure_total{kind=timeout|error}` so auth-DB pressure is
a metric, not a log dive. Runaway statements now surface as fast errors
that the existing error handlers turn into 5xx, and the pool cannot hold
the whole auth path behind one slow tenant login.

## Verification and limits

- Unit tests `services/atlas_observability/test_db_pool_config.py`
  (7 tests): defaults, prefixed env overrides, invalid-value fallback,
  no PG connect_args for SQLite URLs, empty env treated as default, the
  503 + `Retry-After` + metric behavior of the guard, and that the guard
  never swallows unrelated exceptions.
- `python -m py_compile` clean on the touched Python files.
- Node-side behavior (statement actually cancelled at 15s, pool
  exhaustion under load) requires a live Postgres: CI run plus a staging
  psql check
  (`SET statement_timeout='15s'; SELECT pg_sleep(30);` must error) - not
  executed in this environment and marked as such in the PR.
