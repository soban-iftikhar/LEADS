import logging
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from celery import group

from celery_app import app

SCRAPER_DIR = Path(__file__).resolve().parent
LOG_DIR = SCRAPER_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

SPIDERS = ["zameen", "olx", "graana", "ilaan"]
SINCE_HOURS = int(os.getenv("DAILY_SINCE_HOURS", "24"))
MAX_RECORDS = int(os.getenv("DAILY_MAX_RECORDS", "1000"))

log = logging.getLogger(__name__)


@app.task(
    bind=True,
    name="tasks.run_spider",
    max_retries=2,
    default_retry_delay=300,
    soft_time_limit=1700,
    time_limit=1800,
)
def run_spider(self, name, since_hours=SINCE_HOURS, max_records=MAX_RECORDS):
    """Run one spider in its own process. Each worker binds its own proxy IP,
    so concurrent workers scrape different platforms from different egress IPs."""
    cmd = [
        sys.executable, "-m", "scrapy", "crawl", name,
        "-a", "full_scrape=true",
        "-a", f"since_hours={since_hours}",
        "-a", f"max_records={max_records}",
        "-a", f"job_id={self.request.id}",
    ]
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    logfile = LOG_DIR / f"{name}_{stamp}.log"

    with open(logfile, "w") as fh:
        result = subprocess.run(cmd, cwd=SCRAPER_DIR, stdout=fh, stderr=subprocess.STDOUT, text=True)

    if result.returncode != 0:
        log.error("%s exited %s (see %s)", name, result.returncode, logfile)
        raise self.retry(exc=RuntimeError(f"{name} exited {result.returncode}"))

    log.info("%s finished cleanly", name)
    return {"spider": name, "returncode": 0, "log": str(logfile)}


@app.task(name="tasks.daily_refresh")
def daily_refresh():
    """Fan out all spiders as a parallel group. Workers pick them up
    concurrently up to the configured worker concurrency."""
    log.info("Dispatching daily refresh: %s", SPIDERS)
    job = group(run_spider.s(name) for name in SPIDERS)
    return job.apply_async().id
