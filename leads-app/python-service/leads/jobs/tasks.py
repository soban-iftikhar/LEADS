"""Bridge from the web app to Celery (SPEC_00 section 1.2).

The web app never calls Python directly: it inserts an ops.job_requests row and this
task, run by beat every 10 seconds, claims due rows and starts the matching work.
"""

import logging
import socket

from psycopg.types.json import Jsonb

from celery_app import app
from leads.crawl.tasks import start_run
from leads.db import get_pool

log = logging.getLogger(__name__)


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
