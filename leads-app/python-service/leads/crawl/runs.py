"""Crawl run orchestration shared by leads.crawl.tasks and scripts/daily_scrape.py (SPEC_01 section 5).

A run is one row in master.crawl_runs plus one row per portal in master.crawl_run_portals.
Two guards stop a second run for the same day:
  1. Redis  SET lock:daily_refresh:<date> NX EX 21600      (fast path)
  2. unique master.crawl_runs.lock_key = "<trigger>:<date>" (holds even if Redis is flushed)
"""

import logging
import os
import signal
import subprocess
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from psycopg.types.json import Jsonb

from leads.settings import get_settings

log = logging.getLogger(__name__)

SERVICE_DIR = Path(__file__).resolve().parents[2]
LOG_DIR = get_settings().crawl_log_dir
PKT = ZoneInfo("Asia/Karachi")

LOCK_TTL_SECONDS = 21600          # 6 h
WINDOW_HOURS = get_settings().crawl_window_hours
CATCHUP_AFTER_HOURS = 25
STALE_RUN_HOURS = 4               # a run still `running` after this is dead
SPIDER_SOFT_LIMIT = 2 * 3600      # 2 h
SPIDER_HARD_LIMIT = int(2.5 * 3600)
LOCKED_TRIGGERS = ("schedule", "catchup")


def utcnow() -> datetime:
    return datetime.now(UTC)


def pkt_date(now: datetime | None = None) -> date:
    return (now or utcnow()).astimezone(PKT).date()


def lock_name(day: date) -> str:
    return f"lock:daily_refresh:{day.isoformat()}"


def acquire_day_lock(redis_client, day: date) -> bool:
    """True if this caller now owns today's run. False if someone already took it."""
    return bool(redis_client.set(lock_name(day), utcnow().isoformat(), nx=True, ex=LOCK_TTL_SECONDS))


# --- run rows ------------------------------------------------------------------

def active_portals(conn) -> list[str]:
    return [r[0] for r in conn.execute(
        "SELECT slug FROM config.portals WHERE active ORDER BY slug").fetchall()]


def create_run(pool, trigger: str, window_hours: int, day: date) -> tuple[str, list[str]] | None:
    """Insert the run and its portal rows. None if a run with this lock_key already exists."""
    lock_key = f"{trigger}:{day.isoformat()}" if trigger in LOCKED_TRIGGERS else None
    with pool.connection() as conn, conn.transaction():
        row = conn.execute(
            """INSERT INTO master.crawl_runs (trigger, window_hours, status, lock_key)
               VALUES (%s, %s, 'running', %s)
               ON CONFLICT (lock_key) DO NOTHING RETURNING id""",
            (trigger, window_hours, lock_key)).fetchone()
        if row is None:
            return None
        run_id = str(row[0])
        portals = active_portals(conn)
        for platform in portals:
            conn.execute(
                "INSERT INTO master.crawl_run_portals (run_id, platform, status) VALUES (%s, %s, 'running')",
                (run_id, platform))
    return run_id, portals


def mark_portal_started(pool, run_id: str, platform: str) -> None:
    with pool.connection() as conn:
        conn.execute(
            "UPDATE master.crawl_run_portals SET started_at = now() WHERE run_id = %s AND platform = %s",
            (run_id, platform))


def fail_portal_if_unfinished(pool, run_id: str, platform: str, error: str) -> bool:
    """The spider writes its own result on close. If it never did (crash, kill), record why."""
    with pool.connection() as conn:
        cur = conn.execute(
            """UPDATE master.crawl_run_portals
               SET status = 'failed', finished_at = now(), error = %s
               WHERE run_id = %s AND platform = %s AND status = 'running'""",
            (error[:500], run_id, platform))
        return cur.rowcount > 0


def summarize(portal_rows: list[tuple]) -> str:
    """Run status from portal (status, error) pairs.

    success: every portal succeeded with no error note
    failed:  every portal failed
    partial: anything in between (some failed, or a token expired mid-run)
    Portals skipped on purpose (manual run for selected portals) do not count.
    """
    portal_rows = [(s, e) for s, e in portal_rows if s != "skipped"]
    if not portal_rows:
        return "failed"
    statuses = [s for s, _ in portal_rows]
    if all(s == "failed" for s in statuses):
        return "failed"
    if all(s == "success" for s in statuses) and not any(e for _, e in portal_rows):
        return "success"
    return "partial"


def finalize_run(pool, run_id: str) -> tuple[str, dict]:
    """Close the run: anything still `running` is failed, then compute the run status."""
    with pool.connection() as conn, conn.transaction():
        conn.execute(
            """UPDATE master.crawl_run_portals
               SET status = 'failed', finished_at = now(), error = COALESCE(error, 'did not report a result')
               WHERE run_id = %s AND status = 'running'""", (run_id,))
        rows = conn.execute(
            """SELECT platform, status, error, COALESCE(items_seen, 0), COALESCE(items_new, 0),
                      COALESCE(items_updated, 0), COALESCE(items_rejected, 0), COALESCE(errors, 0)
               FROM master.crawl_run_portals WHERE run_id = %s ORDER BY platform""", (run_id,)).fetchall()
        status = summarize([(r[1], r[2]) for r in rows])
        stats = {
            "portals": {r[0]: {"status": r[1], "error": r[2], "seen": r[3], "new": r[4],
                               "updated": r[5], "rejected": r[6], "errors": r[7]} for r in rows},
            "seen": sum(r[3] for r in rows), "new": sum(r[4] for r in rows),
        }
        problems = "; ".join(f"{r[0]}: {r[2]}" for r in rows if r[2]) or None
        conn.execute(
            "UPDATE master.crawl_runs SET status = %s, finished_at = now(), stats = %s, error = %s WHERE id = %s",
            (status, Jsonb(stats), problems, run_id))
    return status, stats


def should_alert(pool, run_id: str, status: str) -> bool:
    """Email the admin when a run failed, or was partial two runs in a row (SPEC_01 5.2.7)."""
    if status == "failed":
        return True
    if status != "partial":
        return False
    with pool.connection() as conn:
        prev = conn.execute(
            """SELECT status FROM master.crawl_runs
               WHERE id <> %s AND status <> 'running' AND trigger IN ('schedule', 'catchup')
               ORDER BY started_at DESC LIMIT 1""", (run_id,)).fetchone()
    return bool(prev and prev[0] == "partial")


# --- catch-up ------------------------------------------------------------------

def fail_stale_runs(pool, now: datetime | None = None) -> int:
    """A run still `running` after STALE_RUN_HOURS lost its workers; close it as failed."""
    cutoff = (now or utcnow()) - timedelta(hours=STALE_RUN_HOURS)
    with pool.connection() as conn, conn.transaction():
        ids = [r[0] for r in conn.execute(
            "SELECT id FROM master.crawl_runs WHERE status = 'running' AND started_at < %s", (cutoff,)).fetchall()]
        for run_id in ids:
            conn.execute(
                """UPDATE master.crawl_run_portals SET status = 'failed', finished_at = now(),
                          error = COALESCE(error, 'run timed out') WHERE run_id = %s AND status = 'running'""",
                (run_id,))
            conn.execute(
                """UPDATE master.crawl_runs SET status = 'failed', finished_at = now(),
                          error = COALESCE(error, 'run timed out: workers gave no result') WHERE id = %s""",
                (run_id,))
    return len(ids)


def needs_catchup(pool, now: datetime | None = None) -> bool:
    """True if the last good run started more than 25 h ago and nothing is running now."""
    now = now or utcnow()
    with pool.connection() as conn:
        running = conn.execute("SELECT 1 FROM master.crawl_runs WHERE status = 'running' LIMIT 1").fetchone()
        if running:
            return False
        last = conn.execute(
            "SELECT max(started_at) FROM master.crawl_runs WHERE status IN ('success', 'partial')").fetchone()[0]
    return last is None or (now - last) > timedelta(hours=CATCHUP_AFTER_HOURS)


# --- running one portal ----------------------------------------------------------

_children: set[subprocess.Popen] = set()


def stop_children() -> None:
    """Stop every spider this process started (used when the runner itself is told to stop)."""
    for proc in list(_children):
        if proc.poll() is None:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
    for proc in list(_children):
        try:
            proc.wait(timeout=30)
        except subprocess.TimeoutExpired:
            proc.kill()
        _children.discard(proc)


def spider_command(run_id: str, platform: str, window_hours: int) -> list[str]:
    return [
        sys.executable, "-m", "scrapy", "crawl", platform,
        "-a", "full_scrape=true",
        "-a", f"since_hours={window_hours}",
        "-a", f"run_id={run_id}",
    ]


def run_portal_process(pool, run_id: str, platform: str, window_hours: int = WINDOW_HOURS,
                       timeout: int = SPIDER_HARD_LIMIT) -> dict:
    """Run one spider as a child process and make sure its portal row ends up finished."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logfile = LOG_DIR / f"{platform}_{utcnow():%Y%m%d_%H%M%S}.log"
    mark_portal_started(pool, run_id, platform)
    proc = None
    try:
        with open(logfile, "w") as fh:
            proc = subprocess.Popen(spider_command(run_id, platform, window_hours), cwd=SERVICE_DIR,
                                    stdout=fh, stderr=subprocess.STDOUT, start_new_session=True)
            _children.add(proc)
            returncode = proc.wait(timeout=timeout)
        error = None if returncode == 0 else f"spider exited with code {returncode} (see {logfile.name})"
    except subprocess.TimeoutExpired:
        returncode, error = -1, f"spider exceeded {timeout} s and was stopped"
    finally:
        if proc is not None and proc.poll() is None:
            # also runs when Celery's soft time limit interrupts the wait
            try:
                os.killpg(proc.pid, signal.SIGTERM)
                proc.wait(timeout=30)
            except Exception:  # noqa: BLE001
                proc.kill()
        _children.discard(proc)
    fail_portal_if_unfinished(pool, run_id, platform, error or "spider ended without reporting a result")
    return {"platform": platform, "returncode": returncode, "log": str(logfile), "error": error}
