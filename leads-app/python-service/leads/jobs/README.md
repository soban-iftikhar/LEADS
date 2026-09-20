# leads.jobs

Status: not built yet. Celery queue: `default`.

| File | Does |
|---|---|
| `dispatch_requests.py` | every 10 s: claim `ops.job_requests` rows with `FOR UPDATE SKIP LOCKED`, enqueue the matching task |
| `scheduled.py` | housekeeping: close expired orders, purge phones, email digest, no-reply sweep |
| `heartbeat.py` | each service upserts `ops.heartbeats` once a minute |

Job request lifecycle: `PENDING -> RUNNING -> DONE | FAILED`.
- A claim sets `locked_at`, `locked_by` and increments `attempts`.
- On failure with attempts left: back to `PENDING` with `run_after` pushed out (exponential backoff).
- A `RUNNING` row whose lock is older than the task time limit is put back to `PENDING` (the worker died).
- `dedupe_key` is unique: inserting the same request twice creates one job.
