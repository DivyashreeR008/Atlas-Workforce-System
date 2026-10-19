# Database index conventions (Atlas Workforce System)

This document is the review contract behind the index audit. Paired with
`docs/db-index-audit.md`, it defines how new indexes are proposed,
reviewed and shipped, so that coverage is consistent rather than a matter
of whichever service was touched last.

## Tenant-first composite order

Every table is tenant-scoped and almost every list endpoint filters by
`tenant_id` first. Composite indexes therefore lead with `tenant_id`:

```
(tenant_id, <equality columns in selectivity order>, <range/sort column>)
```

- Equality columns (typically `status`, `department`, `job_id`) come before
  the range or sort column (typically `created_at`), because a range
  predicate after it can only use the index up to that point.
- Example: `audit_logs` list filters are `(tenant_id, created_at)` ->
  `idx_audit_tenant_created` is the model to copy.
- Remaining un-indexed models (see `docs/db-index-audit.md`) are proposed
  as **tenant-led single-column** `(tenant_id)` first; composite widening
  (e.g. `(tenant_id, status)`) is added only when the slow-query evidence
  (from `atlas_db_query_duration_seconds` / `db.slow_query` events)
  actually shows the second column in the filter.

## Naming

- Single entity isolation: `idx_<entity>_<metric>` in service code
  (`idx_onboard_assign_tenant`), or `idx_<table>_<cols>` in migrations
  (`idx_jobs_tenant_status`).
- Unique constraints that protect the domain (e.g. per-tenant emails) are
  named `ix_<table>_<cols>` if created by SQLAlchemy, or
  `uq_<table>_<cols>` in migration files; keep whatever the file already
  uses and never rename existing indexes.

## When NOT to index

- The table is write-heavy and the column is not used in list/filter paths
  (every index is a write amplifier on payroll, attendance and audit
  insert paths).
- The table is small enough that scans are cheaper than the write penalty
  (config tables like `encryption_keys` are row-count limited; skip unless
  evidence says otherwise).
- The query pattern is then only ever used with the PK or already-covered
  by a UNIQUE constraint.
- The column has very low cardinality on its own (like `enabled`) and is
  not paired with `tenant_id` - do not index it alone.
- The endpoint first-page size is 1 (single-record lookups by PK).

## Process

1. Slow-query evidence first: services emit `db.slow_query` log events and
   `atlas_db_query_duration_seconds` histograms. Threshold is
   `ATLAS_SLOW_QUERY_MS` (500 ms default). Postgres-level
   `log_min_duration_statement` mirrors it in the database itself.
2. Offenders go into `docs/db-index-audit.md` with the raw query shape.
3. Indexes ship as **versioned Flyway/SQL migrations** (`V<n>__<name>.sql`),
   never `create_all` shortcuts and never inline `create_all` table args on
   existing tables; SQLAlchemy `__table_args__` are added for **new**
   tables only, or as `CREATE INDEX IF NOT EXISTS` for existing ones.
4. Open PRs receive the before/after execution plan (`EXPLAIN (ANALYZE,
   BUFFERS)`) for at least the top five queries the change claims to fix,
   and a confirm that no list endpoint got more than one new index each.

## Status

Adopted with this audit; follow-up migrations (files, not schema edits in
service code) are listed in `docs/db-index-audit.md`, section "Proposed
migrations".
