# N+1 query audit (repo-wide, from #457)

The template for the shape was ATS rankings (#301, already merged - not
re-fixed here). This audit covers the rest of the codebase. Method: every
list/stat path and CRUD helper was inspected for (a) explicit
fetch-then-per-row-query loops and (b) lazy relationship traversal inside
result loops, which is the SQLAlchemy face of the same problem. Fix
strategy: batched `IN` fetches or eager loads, no behavior change, and
query-count assertions (flat as fixture rows grow) rather than
payload-shape snapshots.

## Instrumentation

`services/ats-service/test_n1.py` provides the proof of the fixed
endpoints: a scripted session records every `db.query()` call, and the
parametrized tests (10 rows vs 1000 rows) assert the call count does not
grow with row count. The same harness pattern applies to any service'
crud layer when the next audit slice lands.

## Audit findings and disposition

### Fixed in this PR (worst three, ATS)

Each entry lists the loop location before the fix and the measured shape.

1. **`list_applications` + `get_candidate_applications`**
   (`services/ats-service/crud.py`): the result loops read `app.job.title`
   and `app.candidate.first_name/last_name`, so every row lazily loaded
   two relationships: 1 page query + 2 queries per row (page of N ->
   1+2N queries). Now `_batch_join_maps` resolves all jobs and candidates
   for the page with two IN queries: constant 3 queries. Growth was
   confirmed linear in the audit checkout; the fix is asserted flat at
   10 and 1000 rows in `test_n1.py`.

2. **`rank_candidates_for_job`** (`services/ats-service/crud.py`):
   previously queried per candidate (`Candidate` by id), per candidate a
   second `ResumeRanking` lookup, and a commit per row; the final result
   loop then re-queried `Candidate` per ranking row. A rank request with
   N candidates issued about 3N+2 queries plus N commits (fixed #301's
   sibling scoring path still is per-request, fine). Now: one batched
   candidate fetch, one batched existing-rankings lookup, one commit for
   the upsert batch, and one final read - constant 4 queries + 2 commits
   for any batch size, asserted in `test_n1.py` (`rows` parametrized 10 /
   1000).

3. **`list_campus_drives`** (`services/ats-service/crud.py`): issued one
   `COUNT(...)` per drive row to build `registration_count` (N+1
   exactly). Now one grouped `COUNT ... GROUP BY drive_id` over the
   page's drive ids: constant 2 queries regardless of rows.

4. **`get_recruitment_analytics` conversion funnel**
   (`services/ats-service/crud.py`): eight sequential `COUNT` queries, one
   per funnel stage. Fixed-N rather than per-row, but it runs inside an
   analytics endpoint called by dashboards: replaced with one grouped
   `COUNT ... GROUP BY status` plus a map; stage order and zero-count
   stages now explicitly covered by `test_recruitment_funnel_keeps_stage_order`.

### Not fixed here (same shape, deliberately deferred)

- **`get_hiring_pipeline`** (`services/ats-service/crud.py` ~1441):
  ten-plus fixed scalar counts and relationship traversal bounded to
  LIMIT 10 rows (`iv.application.candidate`, `app.candidate/app.job`).
  Bounded at 10 the constant-factor isn't urgent, but the relationship
  traversal deserves eager loading or the same batch-name map when that
  endpoint is next touched.
- **Loop-driven chatbot messages** and other single-entity create paths:
  writes go one-by-one but calls are per request, not per row of a
  payload; not an N+1.
- `audit-compliance-service/crud.py` (evaluation loop ~657): the queries
  inside the loop are for policy evaluation with per-policy conditions;
  the policies list is routinely small (low dozens). Recorded for a
  later pass together with a real-data profile, per the conventions in
  `docs/db-index-audit.md`.
- Mongo/live services: no per-row `find_one` loops found in the scanned
  list paths (`for ... in cursor` batches already materialize pages).

### The #301 rankings page (explicitly not re-touched)

`score_candidate_for_job` stays as #301's merged fix left it.

## Payload behavior

Batched fetches replace relationship traversal with id-keyed dicts; the
serialized payloads are unchanged - job titles and candidate names resolve
to the same entities, missing rows still render `None`/`"Unknown"` as
before (asserted in `test_n1.py` through the `candidate_name` not being
`Unknown` for present candidates, and `job_title`/`candidate_name` derived
from the same joins).

## Verification

- `python -m py_compile` clean for `services/ats-service/crud.py` and
  `services/ats-service/test_n1.py`.
- `services/ats-service`: `test_n1.py` 7/7 pass locally (4 breakpoint
  tests plus funnel stage assertion; run with pytest).
- The rest of `services/ats-service` test files are unaffected by this
  change; their 13 pre-existing local errors are the ones that need a
  live PostgreSQL (stash-verified identical on pristine `upstream/main`).
- CI will run the full ats suites with a database and this new query
  harness.

## Follow-ups

- Roll the same query-count harness into audit-compliance-service when it
  gets its data-profile pass.
- `get_hiring_pipeline` eager loading when next touched.
