# Database index audit (originates from #456)

Scope: Postgres-backed Python services, the payroll Java service (Flyway
migrations), and the Mongo employee directory. Evidenced path: every
Python service now installs the shared slow-query listener
(`atlas_observability.sql_slow_query`), which records statement durations
in `atlas_db_query_duration_seconds` and logs any statement above the
threshold as a `db.slow_query` event (see `docs/db-index-conventions.md`
for the review process). This audit is read-only against the schema; it
names what to fix and what to leave alone.

## Runtime instrumentation added in this PR

- One shared listener wired into every engine (analytics, ats,
  audit-compliance, employee-lifecycle, integration, security,
  workforce-planning).
- Threshold: 500 ms default, overridable via `ATLAS_SLOW_QUERY_MS`; the
  same env documents Postgres-level `log_min_duration_statement = 500ms`
  as the database-side threshold.
- No schema changes anywhere in this PR - safe to merge; indexes ship in a
  follow-up versioned-migration PR pair per the above convention note.

## Coverage inventory (generated from `services/*/models.py`)

| service | models | with indexes | without any |
|---|---|---|---|
| ats-service | 13 | 1 | 12 |
| audit-compliance-service | 8 | 4 | 4 |
| employee-lifecycle-service | 18 | 18 | 0 |
| integration-service | 5 | 5 | 0 |
| security-service | 11 | 6 | 5 |
| workforce-planning-service | 15 | 15 | 0 |

Existing explicit indexes already follow tenant-first composites in most
places (`idx_audit_tenant_created`, `idx_wf_demand_tenant_period`,
`ix_candidates_tenant_id_status`), so the convention below is mostly a
formalization of current practice, not a rewrite.

## Un-indexed models, matched to their actual filter patterns

These are the read paths the `WHERE` clauses run on, taken from the
services' `crud.py` layer. Each is a candidate for the follow-up
migration PR; the proposed index is the tenant-led start position
discussed above (widened only if slow-query evidence demands more).

### ats-service (worst coverage; highest-volume list pages)

| table | actual filter pattern (crud.py) | proposed |
|---|---|---|
| jobs | `tenant_id` + optional `status`/`department`/`employment_type` (list jobs, line 58-64) | `(tenant_id)` then evidence for `(tenant_id, status)` |
| applications | `candidate_id` / `job_id` + tenant join (lines 136-138, 251-253) | `(job_id)`, `(candidate_id)` |
| interviews | list by tenant via job join | `(tenant_id)` |
| offers | list by candidate/tenant | `(candidate_id)` |
| resumes | list by candidate | `(candidate_id)` |
| campus_registrations | list by drive | `(drive_id)` |
| referrals | list by candidate/job | `(candidate_id)` |

No index yet on `chatbot_sessions`, `chatbot_messages` (full-tenant lists
are paginated); keep low priority until evidence arrives.

### audit-compliance-service

| table | actual filter pattern | proposed |
|---|---|---|
| compliance_policies | by tenant and type (line 466+) | `(tenant_id)` |
| compliance_violations | tenant + `detected_at` date range (line 537) | `(tenant_id, detected_at)` |
| audit_chain_anchors | by tenant (lines 152, 179) | `(tenant_id)` |
| data_retention_policies | by tenant | `(tenant_id)` |
| gdpr_consent_records | by tenant + subject | `(tenant_id)` |

`audit_logs` is already indexed; the (tenant, event_type, date) combined
query at line 341+ may justify `(tenant_id, event_type, created_at)`
later - only if evidence confirms the composite adds value beyond the
existing `(tenant_id, created_at)`.

### security-service

| table | actual filter pattern | proposed |
|---|---|---|
| privileged_roles | by tenant (line 369) | `(tenant_id)` |
| data_classifications | by tenant | `(tenant_id)` |
| dlp_incidents | by tenant (+ status/date range) | `(tenant_id)` |
| dl_policies | by tenant | `(tenant_id)` |
| data_residency_policies | by tenant | `(tenant_id)` |

`conditional_access_policies`/`zero_trust_policies` list by
tenant+enabled; tenant-led single-column stays first, adding
`(tenant_id, enabled)` only when evidence suggests it.

### lifecycle + workforce-planning + integration

Full coverage already; nothing proposed here, per the "when NOT to
index" section of `docs/db-index-conventions.md` (payroll-ish
write-heavy tables take a write penalty for an index that list endpoints
do not use).

### Other stores

- Mongo (`employee-python-service`): already creates
  `(tenant_id, email)` unique, plus tenant + name + department and
  `(tenant_id, name)` / `(tenant_id, department, position)`. No actions.
- Postgres tables created by the analytics service's own SQL
  (`payroll_records`, `attendance_records`) - filters are
  `tenant_id = :tenant AND period = :period` and
  `tenant_id = :tenant AND date RANGE`: these are created by
  `Base.metadata.create_all` elsewhere (payroll Java service owns them);
  index proposals for them belong to the payroll-Java Flyway chain
  (`CREATE INDEX IF NOT EXISTS idx_payroll_records_tenant_period ON
  payroll_records (tenant_id, period)` and
  `idx_attendance_records_tenant_date ON attendance_records (tenant_id,
  date)`), captured for the follow-up PR.

## Proposed migrations (follow-up PR, for review, NOT in this branch)

Named per this corresponding service's migration layout (Flyway-style
numbered SQL files next to `db/migration/V1__init.sql` where those
already exist, and one `python -c` schema check for SQLAlchemy-backed
tables):

1. `ats-service`: `CREATE INDEX CONCURRENTLY IF NOT EXISTS` on
   `jobs(tenant_id)`, `applications(job_id)`, `applications(candidate_id)`,
   `interviews(tenant_id)`, `offers(candidate_id)`, `resumes(candidate_id)`,
   `campus_registrations(drive_id)`, `referrals(candidate_id)`.
2. `audit-compliance-service`: `compliance_policies(tenant_id)`,
   `compliance_violations(tenant_id, detected_at)`,
   `audit_chain_anchors(tenant_id)`,
   `data_retention_policies(tenant_id)`, `gdpr_consent_records(tenant_id)`.
3. `security-service`: `privileged_roles(tenant_id)`,
   `data_classifications(tenant_id)`, `dlp_incidents(tenant_id)`,
   `dlp_policies(tenant_id)`, `data_residency_policies(tenant_id)`.
4. `payroll-java-service`: `payroll_records(tenant_id, period)`,
   `attendance_records(tenant_id, date)`.
5. analytics read-only SQL does not own schema, so no direct DDL.

Before/after `EXPLAIN (ANALYZE, BUFFERS)` on top 5 queries and k6
timings will be attached to the follow-up migration PRs; they are
deliberately absent here because this PR is schema-free by design (the
issue's "audit stays read-only" acceptance criterion), and data volumes
in a CI sandbox would not produce a meaningful plan anyway.

## Verification in this PR

- Unit tests for the instrumentation itself:
  `services/atlas_observability/test_sql_slow_query.py` (6 tests) -
  threshold parsing and rejection of bad values, slow event emission at
  zero threshold, no event for fast statements, histogram count
  recording, failure event logging.
- `python -m py_compile` clean for every service `main.py` wired in.
- CI runs each service's pytest suite against the same listener installed
  at engine creation; no behavior change beyond logging/metrics.

## Deferred (with reasons)

- No index is created here: issue's stated "audit PR schema-free" floor.
- No dashboard panel: metrics exist; the panel is one JSON change that
  belongs with the observability dashboards PR touching `grafana/`
  (follow-up).
- No k6 runs: no load source in this environment; the follow-up migration
  PR will carry the before/after numbers for the five hottest queries.
