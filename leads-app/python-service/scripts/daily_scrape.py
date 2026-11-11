#!/usr/bin/env python3
"""Run one crawl without Celery: the fallback for host cron or a platform cron job.

Uses the same Redis lock and the same run tables as the beat schedule, so it is safe to
have both: whichever starts first owns the day, the other exits.

    # crontab: 02:00 Pakistan time (21:00 UTC)
    0 21 * * *  cd /app && python scripts/daily_scrape.py >> logs/cron.log 2>&1

Usage:
    python scripts/daily_scrape.py                       # scheduled run, all active portals
    python scripts/daily_scrape.py --trigger manual      # no day lock
    python scripts/daily_scrape.py --trigger manual --portal olx --portal ilaan
    python scripts/daily_scrape.py --catchup             # only if the last good run is > 25 h old

Exit code: 0 success, 1 partial, 2 failed, 3 skipped (already ran / not needed).
"""

import argparse
import logging
import os
import signal
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import redis  # noqa: E402

from leads import runs  # noqa: E402
from leads.alerts import crawl_run_alert  # noqa: E402
from leads.db import close_pool, get_pool  # noqa: E402
from leads.settings import get_settings  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("daily_scrape")

EXIT = {"success": 0, "partial": 1, "failed": 2}


def _stop(signum, _frame):
    # Turn SIGTERM into an exception so the spiders' cleanup (leads.runs) runs and no
    # child process is left behind when cron or the platform stops this script.
    raise SystemExit(128 + signum)


def main() -> int:
    signal.signal(signal.SIGTERM, _stop)
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--trigger", choices=["schedule", "manual", "catchup"], default="schedule")
    ap.add_argument("--catchup", action="store_true", help="run only if a catch-up is needed")
    ap.add_argument("--portal", action="append", help="limit to these portals (repeatable)")
    ap.add_argument("--window-hours", type=int, default=runs.WINDOW_HOURS)
    args = ap.parse_args()

    pool = get_pool()
    trigger = "catchup" if args.catchup else args.trigger
    if args.catchup:
        runs.fail_stale_runs(pool)
        if not runs.needs_catchup(pool):
            log.info("no catch-up needed")
            return 3

    day = runs.pkt_date()
    if trigger in runs.LOCKED_TRIGGERS:
        rds = redis.Redis.from_url(os.getenv("CELERY_BROKER_URL", get_settings().celery_broker_url))
        if not runs.acquire_day_lock(rds, day):
            log.info("run for %s already taken (Redis lock); exiting", day)
            return 3
    created = runs.create_run(pool, trigger, args.window_hours, day)
    if created is None:
        log.info("%s run for %s already exists; exiting", trigger, day)
        return 3
    run_id, portals = created
    if args.portal:
        skipped = [p for p in portals if p not in args.portal]
        with pool.connection() as conn:
            for p in skipped:
                conn.execute(
                    """UPDATE master.crawl_run_portals SET status = 'skipped', finished_at = now()
                       WHERE run_id = %s AND platform = %s""", (run_id, p))
        portals = [p for p in portals if p in args.portal]

    log.info("run %s (%s): %s", run_id, trigger, portals)
    try:
        with ThreadPoolExecutor(max_workers=max(1, len(portals))) as pool_exec:
            for res in pool_exec.map(lambda p: runs.run_portal_process(pool, run_id, p, args.window_hours), portals):
                log.info("%s: %s", res["platform"], res["error"] or "finished")
    except (KeyboardInterrupt, SystemExit):
        log.error("interrupted: stopping spiders and closing the run")
        runs.stop_children()
        runs.finalize_run(pool, run_id)
        raise

    status, stats = runs.finalize_run(pool, run_id)
    log.info("run %s: %s (seen %s, new %s)", run_id, status, stats["seen"], stats["new"])
    for platform, p in stats["portals"].items():
        log.info("  %-7s %-8s seen=%s new=%s errors=%s %s", platform, p["status"], p["seen"], p["new"],
                 p["errors"], p["error"] or "")
    if runs.should_alert(pool, run_id, status):
        crawl_run_alert(run_id, status, stats)
    close_pool()
    return EXIT[status]


if __name__ == "__main__":
    sys.exit(main())
