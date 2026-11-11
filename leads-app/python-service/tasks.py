"""Celery tasks for the scraping engine (SPEC_01 section 5).

crawl.daily_refresh    beat, 02:00 Asia/Karachi: lock, create the run, fan out one task per portal
crawl.run_portal       queue `crawl`: run one spider as a child process (2 h soft / 2.5 h hard)
crawl.finalize_run     chord callback: close the run as success / partial / failed, alert
crawl.catchup_check    hourly and on worker start: start a run if the last good one is > 25 h old
jobs.dispatch_requests every 10 s: turn ops.job_requests rows from the web app into tasks
ops.heartbeat          every minute: proves beat and a worker are alive
"""

import logging
import socket

import redis
from celery import chord, group
from celery.exceptions import SoftTimeLimitExceeded
from celery.signals import worker_ready
from psycopg.types.json import Jsonb

from celery_app import BROKER_URL, app
from leads import runs
from leads.alerts import crawl_run_alert
from leads.db import get_pool

log = logging.getLogger(__name__)


def redis_client():
    return redis.Redis.from_url(BROKER_URL)


def dispatch_portals(run_id: str, portals: list[str], window_hours: int) -> None:
    """One task per portal in parallel; the callback runs when all of them have returned."""
    header = group(run_portal.s(run_id, platform, window_hours) for platform in portals)
    chord(header)(finalize_run.s(run_id))


def start_run(trigger: str, window_hours: int = runs.WINDOW_HOURS, *, pool=None, rds=None,
              now=None, dispatch=dispatch_portals) -> str | None:
    """Create and dispatch a run. Returns its id, or None if today's run already exists."""
    pool = pool or get_pool()
    day = runs.pkt_date(now)
    if trigger in runs.LOCKED_TRIGGERS:
        if not runs.acquire_day_lock(rds or redis_client(), day):
            log.info("daily refresh for %s already taken (Redis lock); exiting", day)
            return None
    created = runs.create_run(pool, trigger, window_hours, day)
    if created is None:
        log.info("%s run for %s already exists (lock_key); exiting", trigger, day)
        return None
    run_id, portals = created
    if not portals:
        runs.finalize_run(pool, run_id)
        log.error("run %s: no active portals in config.portals", run_id)
        return run_id
    log.info("run %s (%s, %s h window): dispatching %s", run_id, trigger, window_hours, portals)
    dispatch(run_id, portals, window_hours)
    return run_id


@app.task(name="crawl.daily_refresh")
def daily_refresh(trigger: str = "schedule"):
    return start_run(trigger)


@app.task(
    bind=True,
    name="crawl.run_portal",
    soft_time_limit=runs.SPIDER_SOFT_LIMIT,
    time_limit=runs.SPIDER_HARD_LIMIT,
    max_retries=2,
)
def run_portal(self, run_id: str, platform: str, window_hours: int):
    """Never raises on its last attempt: the chord callback must always run."""
    pool = get_pool()
    try:
        result = runs.run_portal_process(pool, run_id, platform, window_hours,
                                         timeout=runs.SPIDER_SOFT_LIMIT - 60)
    except SoftTimeLimitExceeded:
        runs.fail_portal_if_unfinished(pool, run_id, platform, "time limit reached (2 h)")
        return {"platform": platform, "returncode": -1, "error": "time limit"}
    except Exception as e:  # noqa: BLE001
        log.exception("run_portal %s crashed", platform)
        result = {"platform": platform, "returncode": -2, "error": str(e)}

    # Retry only when the spider process itself died (network down, out of memory).
    # A spider that ran and reported a blocked portal or expired token is not retried.
    if result["returncode"] not in (0, -1) and self.request.retries < self.max_retries:
        with pool.connection() as conn:
            conn.execute(
                """UPDATE master.crawl_run_portals SET status = 'running', finished_at = NULL, error = NULL
                   WHERE run_id = %s AND platform = %s""", (run_id, platform))
        raise self.retry(countdown=120 * 2 ** self.request.retries, exc=RuntimeError(result["error"]))
    if result["returncode"] not in (0, -1):
        runs.fail_portal_if_unfinished(pool, run_id, platform, result["error"] or "spider failed")
    return result


@app.task(name="crawl.finalize_run")
def finalize_run(results, run_id: str):
    pool = get_pool()
    status, stats = runs.finalize_run(pool, run_id)
    log.info("run %s finished: %s (seen %s, new %s)", run_id, status, stats["seen"], stats["new"])
    if runs.should_alert(pool, run_id, status):
        crawl_run_alert(run_id, status, stats)
    return status


@app.task(name="crawl.catchup_check")
def catchup_check():
    pool = get_pool()
    stale = runs.fail_stale_runs(pool)
    if stale:
        log.warning("closed %s stale run(s) as failed", stale)
    if runs.needs_catchup(pool):
        log.info("last good crawl is older than %s h: starting a catch-up run", runs.CATCHUP_AFTER_HOURS)
        return start_run("catchup")
    return None


@worker_ready.connect
def _catchup_on_start(sender=None, **_):
    # After downtime the first worker to come up checks straight away instead of waiting an hour.
    catchup_check.apply_async(countdown=30)


@app.task(name="jobs.dispatch_requests")
def dispatch_requests(limit: int = 10):
    """Claim pending ops.job_requests rows (written by the web app) and start their tasks."""
    pool = get_pool()
    worker = socket.gethostname()
    with pool.connection() as conn, conn.transaction():
        rows = conn.execute(
            """UPDATE ops.job_requests j
               SET status = 'RUNNING', started_at = now(), locked_at = now(), locked_by = %s,
                   attempts = attempts + 1
               WHERE id IN (
                   SELECT id FROM ops.job_requests
                   WHERE status = 'PENDING' AND run_after <= now() AND type = 'CRAWL_MANUAL'
                   ORDER BY created_at LIMIT %s FOR UPDATE SKIP LOCKED)
               RETURNING id""", (worker, limit)).fetchall()
    for (job_id,) in rows:
        try:
            run_id = start_run("manual")
            with pool.connection() as conn:
                conn.execute(
                    """UPDATE ops.job_requests SET status = 'DONE', finished_at = now(),
                              payload = payload || %s WHERE id = %s""",
                    (Jsonb({"run_id": run_id}), job_id))
        except Exception as e:  # noqa: BLE001
            log.exception("job %s failed", job_id)
            with pool.connection() as conn:
                conn.execute(
                    """UPDATE ops.job_requests
                       SET status = CASE WHEN attempts < max_attempts THEN 'PENDING'::ops."JobStatus"
                                         ELSE 'FAILED'::ops."JobStatus" END,
                           run_after = now() + make_interval(mins => power(2, attempts)::int),
                           error = %s, locked_at = NULL, locked_by = NULL,
                           finished_at = CASE WHEN attempts < max_attempts THEN NULL ELSE now() END
                       WHERE id = %s""", (str(e)[:500], job_id))
    return len(rows)


@app.task(name="ops.heartbeat")
def heartbeat():
    with get_pool().connection() as conn:
        conn.execute(
            """INSERT INTO ops.heartbeats (service, beat_at, meta) VALUES ('beat', now(), %s)
               ON CONFLICT (service) DO UPDATE SET beat_at = now(), meta = EXCLUDED.meta""",
            (Jsonb({"worker": socket.gethostname()}),))
