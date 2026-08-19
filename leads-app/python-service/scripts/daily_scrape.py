#!/usr/bin/env python3
"""
Daily "keep it fresh" run. Invoked once a day by cron — not meant to be
run manually except for testing. Runs each spider broadly (full_scrape),
but only keeps listings from the last SINCE_HOURS hours, capped at
MAX_RECORDS as a safety ceiling per spider — the real selection is time-
based, the cap just prevents one unexpectedly large category from
running away.
"""
import subprocess
import sys
import logging
from datetime import datetime
from pathlib import Path

SCRAPER_DIR = Path(__file__).resolve().parent.parent
SPIDERS = ["zameen", "olx", "graana", "ilaan"]
SINCE_HOURS = 24
MAX_RECORDS = 1000

(SCRAPER_DIR / "logs").mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(SCRAPER_DIR / "logs" / f"daily_{datetime.now():%Y%m%d}.log"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("daily_scrape")


def run_spider(name: str) -> bool:
    cmd = [
        sys.executable, "-m", "scrapy", "crawl", name,
        "-a", "full_scrape=true",
        "-a", f"since_hours={SINCE_HOURS}",
        "-a", f"max_records={MAX_RECORDS}",
    ]
    log.info(f"Starting {name} ...")
    result = subprocess.run(cmd, cwd=SCRAPER_DIR, capture_output=True, text=True)
    if result.returncode != 0:
        log.error(f"{name} exited with code {result.returncode}")
        log.error(result.stderr[-2000:])
        return False
    log.info(f"{name} finished cleanly")
    return True


def main():
    log.info("=== Daily scrape run starting ===")
    results = {}
    for name in SPIDERS:
        # Run sequentially, not in parallel — matches the single-agent
        # design used everywhere else in this project; multi-agent
        # scraping was explicitly deferred until actual volume needs it.
        try:
            results[name] = run_spider(name)
        except Exception as e:
            log.error(f"{name} crashed the runner itself: {e}")
            results[name] = False
    ok = sum(results.values())
    log.info(f"=== Daily scrape run finished: {ok}/{len(SPIDERS)} spiders OK ===")


if __name__ == "__main__":
    main()