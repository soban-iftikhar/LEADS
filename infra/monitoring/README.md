# infra/monitoring

Status: not built yet.

What to watch, and where the signal comes from:

| Signal | Source | Alert when |
|---|---|---|
| Daily crawl ran | `master.crawl_runs` | no `success`/`partial` run in 25 h; any `failed`; `partial` two days running |
| Beat and workers alive | `ops.heartbeats` | a service's `beat_at` is older than 5 minutes |
| Jobs stuck | `ops.job_requests` | `PENDING` older than 10 minutes, or `FAILED` rows |
| Portal blocked or token expired | `master.crawl_run_portals.error` | any portal `failed` |
| Database and Redis up | compose health checks | container unhealthy |

Alerts go by email through Resend to `ADMIN_ALERT_EMAIL`. Optional: Sentry via `SENTRY_DSN`.
